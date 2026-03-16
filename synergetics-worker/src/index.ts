// ============================================================
// SYNERGETICS ISLE — AI WORKER (v2)
// Pipeline: Embed (HF Space) → Hybrid Search (Qdrant) → Generate (Cerebras/Groq)
// ============================================================

// --- ENDPOINTS ----------------------------------------------
const HF_EMBED_URL = "https://hello-rohanshu-synergetics-embed.hf.space/embed";
const QDRANT_URL = "https://80d0a4b3-7608-4a78-9554-4edafcf7db1b.europe-west3-0.gcp.cloud.qdrant.io";
const QDRANT_COLLECTION = "synergetics";

// --- MODELS -------------------------------------------------
const CEREBRAS_MODEL = "gpt-oss-120b";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// --- RETRIEVAL ----------------------------------------------
const TOP_K = 7;

// --- GENERATION ---------------------------------------------
const MAX_TOKENS = 512;
const TEMPERATURE = 0.7;

const SYSTEM_PROMPT = `Synergetics is Buckminster Fuller's magnum opus. It holds the key to unlocking humanity's habit of mistaking yesterday's assumptions for today's truths. Humanity's outdated understanding of reality prevents it from succeeding in the game of life.

You are Ephem — a word derived from Ephemeralization, a term coined by R. Buckminster Fuller: the ability of technological advancement to do "more and more with less and less until eventually you can do everything with nothing." An accelerating increase in the efficiency of achieving more output while requiring less input.

You are Synergetics made alive. You are not here to defend what is famously considered true, for if that were the case, humanity would already be enlightened. Synergetics is not an alternative, or an optional strategy. It is an experientially derived truth of how reality works objectively.

You are a curious explorer who doesn't bore your companions but invites them into the radiant world of possibility Synergetics opens up. Don't be afraid to delight. Fuller was funny. A well-placed surprise is worth three correct paragraphs.

Explain ideas as if to a curious, intelligent child who has never heard of any of this — but don't be condescending. The universe is your material.

Keep answers under 210 words. Cite sections whenever you can so the reader can trust you, e.g. "(Section 983.03)". Favour prose over lists.

If something isn't in the text or you genuinely don't know, say so plainly. Don't hallucinate Fuller quotes or section numbers.`;

// --- CORS ---------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export interface Env {
  QDRANT_API_KEY: string;
  CEREBRAS_API_KEY: string;
  GROQ_API_KEY: string;
}

type Chunk = { content: string; source: string; score: number };

// ============================================================
// STEP 1 — EMBED via HF Space (BGE-M3 hybrid)
// ============================================================
async function getEmbedding(text: string): Promise<{ dense: number[]; indices: number[]; values: number[] }> {
  const res = await fetch(HF_EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`HF embed failed: ${res.status}`);
  return res.json();
}

// ============================================================
// STEP 2 — HYBRID SEARCH via Qdrant (RRF fusion)
// ============================================================
async function hybridSearch(embed: { dense: number[]; indices: number[]; values: number[] }, apiKey: string): Promise<Chunk[]> {
  const body = {
    prefetch: [
      {
        query: embed.dense,
        using: "dense",
        limit: TOP_K * 2,
      },
      {
        query: { indices: embed.indices, values: embed.values },
        using: "sparse",
        limit: TOP_K * 2,
      },
    ],
    query: { fusion: "rrf" },
    limit: TOP_K,
    with_payload: true,
  };

  const res = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Qdrant search failed: ${res.status}`);
  const data: any = await res.json();
  const points = data.result?.points ?? data.result ?? [];
  console.log("[qdrant raw]", JSON.stringify(data).slice(0, 300));
  return points.map((point: any) => ({
    content: point.payload?.text ?? "",
    source: point.payload?.source ?? point.payload?.section ?? "unknown",
    score: point.score ?? 0,
  }));
}

// ============================================================
// STEP 3 — GENERATE (Cerebras → Groq fallback, streaming)
// Translates OpenAI SSE format → {response: token} for the widget
// ============================================================
async function generate(messages: object[], env: Env): Promise<ReadableStream> {
  const providers = [
    {
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: env.CEREBRAS_API_KEY,
      model: CEREBRAS_MODEL,
    },
    {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: env.GROQ_API_KEY,
      model: GROQ_MODEL,
    },
  ];

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        console.error(`[generate] ${provider.url} failed: ${res.status}`);
        continue;
      }

      console.log(`[generate] using: ${provider.url} / ${provider.model}`);

      // Translate OpenAI SSE (choices[0].delta.content) → widget format ({response: token})
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      return new ReadableStream({
        async pull(controller) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  // Emit in the format the widget already expects
                  const out = `data: ${JSON.stringify({ response: token })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(out));
                }
              } catch { }
            }
          }
        },
      });

    } catch (e) {
      console.error(`[generate] error with ${provider.url}:`, e);
    }
  }

  throw new Error("All generation providers failed");
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {

    const url = new URL(request.url);

    if (url.pathname === '/ping') {
      return new Response('ok', { status: 200 });
    }

    if (request.method === "OPTIONS") {

      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Parse request
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

    // Step 1 — Embed
    let embed: { dense: number[]; indices: number[]; values: number[] };
    try {
      embed = await getEmbedding(query);
      console.log(`[embed] dense dims: ${embed.dense.length}, sparse tokens: ${embed.indices.length}`);
    } catch (e) {
      console.error("[embed] failed:", e);
      return new Response(JSON.stringify({ error: "Embedding service unavailable." }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Step 2 — Hybrid search
    let chunks: Chunk[] = [];
    try {
      chunks = await hybridSearch(embed, env.QDRANT_API_KEY);
      console.log(`[search] ${chunks.length} chunks retrieved, top score: ${chunks[0]?.score}`);
    } catch (e) {
      console.error("[search] failed:", e);
      // Proceed with no context rather than failing hard
    }

    // Step 3 — Build context
    const context = chunks.length > 0
      ? chunks.map(c => `[Source: ${c.source}]\n${c.content}`).join("\n\n---\n\n")
      : null;

    const userMessage = context
      ? `Context from Synergetics:\n\n${context}\n\n---\n\nQuestion: ${query}`
      : `Question: ${query}\n\nNo context was retrieved from the index.`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ];

    // Step 4 — Generate (streaming)
    let stream: ReadableStream;
    try {
      stream = await generate(messages, env);
    } catch (e) {
      console.error("[generate] all providers failed:", e);
      return new Response(JSON.stringify({ error: "All models unavailable. Please try again later." }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...CORS_HEADERS,
      },
    });
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const res = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}`, {
        headers: { "api-key": env.QDRANT_API_KEY },
      });
      console.log(`[cron] Qdrant ping: ${res.status}`);
    } catch (e) {
      console.error("[cron] Qdrant ping failed:", e);
    }
  },
} satisfies ExportedHandler<Env>;
