// ============================================================
// SYNERGETICS ISLE — AI WORKER
// Pipeline: Multi-Query Expand → Retrieve & Merge → Generate
// Reranking is handled natively inside .search() — no manual reranker call
// ============================================================

// --- MODELS -------------------------------------------------
const GENERATION_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL   = "@cf/qwen/qwen3-30b-a3b-fp8";
const RERANK_MODEL     = "@cf/baai/bge-reranker-base";
const EXPAND_MODEL     = "@cf/qwen/qwen3-30b-a3b-fp8";

// --- RETRIEVAL ----------------------------------------------
const INDEX_NAME         = "synergetics-isle";
const SEARCH_MAX_RESULTS = 6;   // per query; up to 4 queries × 6 = 24 before dedup
const RERANK_TOP_N       = 5;   // final chunks passed to generation

// --- GENERATION ---------------------------------------------
const MAX_TOKENS = 2347;

const SYSTEM_PROMPT = `You have read Buckminster Fuller's Synergetics. Help the user with thier question, Stay within 300 words. If a good match for the user's query is not found in your indexed data, admit it at the beginning of your answer so the user is aware. Always try to be friendly but honest. Do not request the user to ask a follow up.`;

const EXPAND_PROMPT = `Help the user out with all that you know of Synergetics.`;

// --- CORS ---------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export interface Env {
  AI: Ai;
}

// The content field in AI Search responses is an array of {id, type, text} objects
type ContentBlock = { id: string; type: string; text: string };

type SearchResult = {
  file_id: string;
  filename: string;
  score: number;
  attributes?: Record<string, unknown>;
  content: ContentBlock[];
};

type Chunk = { content: string; source: string; score: number };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // --- PARSE REQUEST --------------------------------------
    let query: string;
    try {
      const body = await request.json() as { query?: string };
      query = body.query?.trim() ?? "";
      if (!query) throw new Error("Empty query");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // --- STEP 1: QUERY EXPANSION ----------------------------
    // Generate 3 queries from different angles using Fuller's vocabulary.
    // Falls back to just the original query if expansion fails.
    let queries: string[] = [query];
    try {
      const expandResult = await (env.AI as any).run(EXPAND_MODEL, {
        messages: [
          { role: "system", content: EXPAND_PROMPT },
          { role: "user", content: query },
        ],
        max_tokens: 120,
        stream: false,
      });
      const raw = expandResult?.response?.trim() ?? "";
      const expanded = raw
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
        .slice(0, 3);
      if (expanded.length > 0) {
        queries = [...new Set([query, ...expanded])].slice(0, 4);
        console.log("[expand] queries:", JSON.stringify(queries));
      }
    } catch (e) {
      console.error("[expand] failed, using original:", e);
    }

    // --- STEP 2: MULTI-QUERY RETRIEVAL ----------------------
    // Run all queries in parallel using the native .search() with built-in reranking.
    // Merge results and deduplicate by file_id.
    const seenIds = new Set<string>();
    let chunks: Chunk[] = [];

    await Promise.all(
      queries.map(async (q) => {
        try {
          const result = await (env.AI as any).autorag(INDEX_NAME).search({
            query: q,
            max_num_results: SEARCH_MAX_RESULTS,
            ranking_options: {
              score_threshold: 0,
            },
            reranking: {
              enabled: true,
              model: RERANK_MODEL,
            },
          });

          if (result?.data?.length > 0) {
            for (const r of result.data as SearchResult[]) {
              if (!seenIds.has(r.file_id)) {
                seenIds.add(r.file_id);
                // content is an array of blocks — join their text
                const text = r.content
                  .map((block) => block.text)
                  .join("\n")
                  .trim();
                chunks.push({
                  content: text,
                  source: r.filename ?? r.file_id ?? "unknown",
                  score: r.score ?? 0,
                });
              }
            }
          }
        } catch (e) {
          console.error("[retrieval] query failed:", q, e);
        }
      })
    );

    // Sort merged pool by score, take top N
    chunks.sort((a, b) => b.score - a.score);
    chunks = chunks.slice(0, RERANK_TOP_N);

    console.log("[retrieval] total unique chunks after merge:", chunks.length);
    if (chunks[0]) {
      console.log("[retrieval] top score:", chunks[0].score, "| source:", chunks[0].source);
    }

    // --- STEP 3: BUILD CONTEXT ------------------------------
    let contextChunks = "";
    if (chunks.length > 0) {
      contextChunks = chunks
        .map((c) => `[Source: ${c.source}]\n${c.content}`)
        .join("\n\n---\n\n");
    }

    const userMessage = contextChunks
      ? `Context from Synergetics:\n\n${contextChunks}\n\n---\n\nQuestion: ${query}`
      : `Question: ${query}\n\nNo context was retrieved from the index.`;

    // --- STEP 4: GENERATION (STREAMING) ---------------------
    const models = [GENERATION_MODEL, FALLBACK_MODEL];
    let stream: ReadableStream | null = null;

    for (const model of models) {
      try {
        stream = await (env.AI as any).run(model, {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: MAX_TOKENS,
          stream: true,
        }) as ReadableStream;
        console.log("[generation] using model:", model);
        break;
      } catch (e) {
        console.error(`[generation] model ${model} failed:`, e);
      }
    }

    if (!stream) {
      return new Response(
        JSON.stringify({ error: "All models unavailable. Please try again later." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  },
} satisfies ExportedHandler<Env>;