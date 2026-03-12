"""
Synergetics-Isle Indexing Script
Crawls local markdown files → chunks by Fuller's section headings
→ BGE-M3 hybrid (dense + sparse) embeddings → Qdrant
"""

import os
import re
import uuid
from pathlib import Path
from dotenv import load_dotenv
from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    SparseVectorParams,
    SparseIndexParams,
    PointStruct,
    SparseVector,
    NamedVector,
    NamedSparseVector,
)

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
CONTENT_DIR = os.getenv("CONTENT_DIR", "../content")
COLLECTION_NAME = "synergetics"
BATCH_SIZE = 64  # safe ceiling for 16GB RAM on CPU with fp32

# --- 1. Load markdown files ---
def load_markdown_files(content_dir: str) -> list[dict]:
    files = []
    for path in Path(content_dir).rglob("*.md"):
        raw = path.read_text(encoding="utf-8")
        # Strip YAML frontmatter
        text = re.sub(r"^---.*?---\s*", "", raw, flags=re.DOTALL).strip()
        if text:
            files.append({"path": str(path), "text": text})
    print(f"Loaded {len(files)} markdown files")
    return files

# --- 2. Chunk by Fuller's section number headings (e.g. ## 100.00, ### 201.10) ---
def chunk_by_headings(files: list[dict]) -> list[dict]:
    chunks = []
    heading_pattern = re.compile(r"^(#{1,5})\s+(\d+\.\d+.*?)$", re.MULTILINE)

    for file in files:
        text = file["text"]
        matches = list(heading_pattern.finditer(text))

        if not matches:
            chunks.append({
                "text": text.strip(),
                "section": Path(file["path"]).stem,
                "source": file["path"],
            })
            continue

        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            chunk_text = text[start:end].strip()

            if len(chunk_text) < 50:
                continue

            chunks.append({
                "text": chunk_text,
                "section": match.group(2).strip(),
                "source": file["path"],
            })

    print(f"Created {len(chunks)} chunks")
    return chunks

# --- 3. Embed with BGE-M3 (dense + sparse) ---
def embed_chunks(chunks: list[dict]) -> list[dict]:
    print("Loading BGE-M3 (first run downloads ~2.2GB)...")
    model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False)

    total = len(chunks)
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [c["text"] for c in batch]

        output = model.encode(
            texts,
            batch_size=BATCH_SIZE,
            max_length=8192,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False,  # skip ColBERT — Qdrant multivec adds complexity, not needed yet
        )

        for j, chunk in enumerate(batch):
            chunk["dense"] = output["dense_vecs"][j].tolist()
            # Sparse: convert to {index: weight} dict, drop near-zero weights
            lexical = output["lexical_weights"][j]
            chunk["sparse_indices"] = [int(k) for k, v in lexical.items() if v > 0.0]
            chunk["sparse_values"] = [float(v) for k, v in lexical.items() if v > 0.0]

        print(f"Embedded {min(i + BATCH_SIZE, total)}/{total}")

    print("Embedding complete")
    return chunks

# --- 4. Push to Qdrant with hybrid collection ---
def push_to_qdrant(chunks: list[dict]):
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    dense_size = len(chunks[0]["dense"])  # 1024 for BGE-M3

    existing = [c.name for c in client.get_collections().collections]

    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                "dense": VectorParams(size=dense_size, distance=Distance.COSINE),
            },
            sparse_vectors_config={
                "sparse": SparseVectorParams(
                    index=SparseIndexParams(on_disk=False)
                )
            },
        )
        print(f"Created hybrid collection: {COLLECTION_NAME}")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists — upserting")

    for i in range(0, len(chunks), 50):
        batch = chunks[i : i + 50]
        points = [
            PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, c["section"] + c["source"])),
                vector={
                    "dense": c["dense"],
                    "sparse": SparseVector(
                        indices=c["sparse_indices"],
                        values=c["sparse_values"],
                    ),
                },
                payload={
                    "text": c["text"],
                    "section": c["section"],
                    "source": c["source"],
                },
            )
            for c in batch
        ]
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"Upserted {i + len(batch)}/{len(chunks)}")

    print("Done — all vectors in Qdrant")

# --- Run ---
if __name__ == "__main__":
    files = load_markdown_files(CONTENT_DIR)
    chunks = chunk_by_headings(files)
    chunks = embed_chunks(chunks)
    push_to_qdrant(chunks)
