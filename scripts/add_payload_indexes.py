# add_payload_indexes.py
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import PayloadSchemaType

load_dotenv()
client = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))

client.create_payload_index("synergetics", "section", PayloadSchemaType.KEYWORD)
client.create_payload_index("synergetics", "source", PayloadSchemaType.KEYWORD)

print("Payload indexes created on section + source")