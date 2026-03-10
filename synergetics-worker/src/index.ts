// ============================================================
// SYNERGETICS ISLE — AI WORKER
// Pipeline: Query Rewrite → Embed & Retrieve → Rerank → Generate
// ============================================================

// --- MODELS -------------------------------------------------
const QUERY_REWRITE_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";   // sharpens user question before search
const GENERATION_MODEL    = "@cf/zai-org/glm-4.7-flash";    // reads context, writes answer
const FALLBACK_MODEL      = "@cf/qwen/qwen3-30b-a3b-fp8";   // if GLM fails, Qwen takes over
const RERANK_MODEL        = "@cf/baai/bge-reranker-base";   // filters chunks before GLM sees them

// --- RETRIEVAL ----------------------------------------------
const INDEX_NAME          = "synergetics-isle";
const SEARCH_THRESHOLD    = 0.3;   // minimum similarity score to include a chunk
const SEARCH_MAX_RESULTS  = 17;    // how many chunks Qwen fetches — wide net
const RERANK_TOP_N        = 11;     // how many chunks survive reranking — GLM reads these

// --- GENERATION ---------------------------------------------
const MAX_TOKENS          = 2347;  // ceiling for GLM output — GLM won't always hit this

const SYSTEM_PROMPT = `You have read Buckminster Fuller's Synergetics. You answer the user's questions, solving their doubts. Remain within a word range of 300 words. If you do not know something, admit it.`;

// --- CORS ---------------------------------------------------
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export interface Env {
	AI: Ai;
}

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

		// --- STEP 1: QUERY REWRITING ----------------------------
		// Qwen 30B sharpens the user's question into better search terms
		// before Qwen embedding searches the index.
		// This is a non-streaming call — we need the result before we can search.
		let searchQuery = query;
		try {
			const rewriteResult = await (env.AI as any).run(QUERY_REWRITE_MODEL, {
				messages: [
					{
						role: "system",
						content: `You are a search query optimizer for Buckminster Fuller's Synergetics. 
Rewrite the user's question into a precise search query using Fuller's exact terminology where appropriate.
Return only the rewritten query — no explanation, no preamble, no punctuation beyond the query itself.`
					},
					{ role: "user", content: query }
				],
				max_tokens: 80,  // query rewrite should be short
				stream: false,
			});
			const rewritten = rewriteResult?.response?.trim();
			if (rewritten) searchQuery = rewritten;
		} catch (e) {
			console.error("Query rewrite failed, using original:", e);
			// non-fatal — fall through with original query
		}

		// --- STEP 2: RETRIEVAL ----------------------------------
		// Qwen embedding model converts searchQuery to a vector
		// and finds the closest matching chunks in the Vectorize index.
		let chunks: Array<{ content: string; source: string; score: number }> = [];
		try {
			const searchResults = await (env.AI as any).autorag(INDEX_NAME).search({
				query: searchQuery,
				max_num_results: SEARCH_MAX_RESULTS,
				score_threshold: SEARCH_THRESHOLD,
			});

			if (searchResults?.data?.length > 0) {
				chunks = searchResults.data.map((r: any) => ({
					content: r.content ?? "",
					source: r.filename ?? r.source ?? r.url ?? "unknown",
					score: r.score ?? 0,
				}));
			}
		} catch (e) {
			console.error("Retrieval failed:", e);
			// non-fatal — will answer from GLM training knowledge
		}

		// --- STEP 3: RERANKING ----------------------------------
		// bge-reranker-base re-scores each chunk specifically against
		// the original user question (not the rewritten one).
		// Keeps only the top RERANK_TOP_N chunks before passing to GLM.
		// This keeps GLM's input tight and reduces noise.
		if (chunks.length > RERANK_TOP_N) {
			try {
				const rerankResult = await (env.AI as any).run(RERANK_MODEL, {
					query: query,  // use original question for reranking judgment
					contexts: chunks.map(c => ({ text: c.content })),
				});

				if (rerankResult?.data?.length > 0) {
					// attach rerank scores and sort descending
					const reranked = rerankResult.data
						.map((r: any, i: number) => ({ ...chunks[i], rerankScore: r.score }))
						.sort((a: any, b: any) => b.rerankScore - a.rerankScore)
						.slice(0, RERANK_TOP_N);
					chunks = reranked;
				}
			} catch (e) {
				console.error("Reranking failed, using raw retrieval order:", e);
				chunks = chunks.slice(0, RERANK_TOP_N);
			}
		}

		// --- STEP 4: BUILD CONTEXT FOR GLM ----------------------
		let contextChunks = "";
		if (chunks.length > 0) {
			contextChunks = chunks
				.map(c => `[Source: ${c.source}]\n${c.content}`)
				.join("\n\n---\n\n");
		}

		const userMessage = contextChunks
			? `Context from Synergetics:\n\n${contextChunks}\n\n---\n\nQuestion: ${query}`
			: `Question: ${query}\n\n(No indexed context retrieved — answer from your training knowledge of Synergetics and note this to the user.)`;

		// --- STEP 5: GENERATION (STREAMING) ---------------------
		// GLM reads the system prompt + retrieved context + question
		// and streams the answer back to the user.
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
				break;
			} catch (e) {
				console.error(`Model ${model} failed:`, e);
				continue;
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