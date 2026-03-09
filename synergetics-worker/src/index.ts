const SYSTEM_PROMPT = `You are a guide to Buckminster Fuller's Synergetics — one of the most unusual and rewarding books ever written. You have read every page.

When answering, draw directly from the indexed text. Be precise about concepts like tensegrity, synergy, vector equilibrium, ephemeralization, and Fuller's geometric thinking. Use his terminology correctly.

Keep answers focused and conversational — this is a dialogue, not a treatise. A few clear paragraphs is better than an encyclopedia entry. If a question goes deep, give the insight and let the reader pull the thread.

If something isn't in the text or you genuinely don't know, say so plainly. Don't hallucinate Fuller quotes or section numbers.

Fuller himself was playful, systems-minded, and relentlessly honest. Channel that.`;

const INDEX_NAME = "synergetics-isle";
const PRIMARY_MODEL = "@cf/zai-org/glm-4.7-flash";
const FALLBACK_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const MAX_TOKENS = 700;
const SEARCH_THRESHOLD = 0.3;
const SEARCH_MAX_RESULTS = 15;

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
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

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

		// Search the indexed Synergetics content
		let contextChunks = "";
		try {
			const searchResults = await (env.AI as any).autorag(INDEX_NAME).search({
				query,
				max_num_results: SEARCH_MAX_RESULTS,
				score_threshold: SEARCH_THRESHOLD,
			});

			if (searchResults?.data?.length > 0) {
				contextChunks = searchResults.data
					.map((r: any) => r.content)
					.join("\n\n---\n\n");
			}
		} catch (e) {
			console.error("AI Search error:", e);
			// Continue without context — fallback to general knowledge
		}

		const userMessage = contextChunks
			? `Context from Synergetics:\n\n${contextChunks}\n\n---\n\nQuestion: ${query}`
			: `Question: ${query}\n\n(Note: indexed search unavailable, answering from general knowledge)`;

		// Try primary model, fall back if it fails
		const models = [PRIMARY_MODEL, FALLBACK_MODEL];
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