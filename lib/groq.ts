// Free image tagger via Groq's free tier (no credit card; ~1000 req/day). One multimodal
// call returns object/scene keywords for catalog search. Quality scoring is handled by
// CLIP-IQA (lib/iqa.ts) — this is tags only. The queue falls back to no tags if this is
// rate-limited or unavailable; it never blocks or fabricates.

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const PROMPT =
  "List the objects and scene in this image as search keywords. " +
  'Reply with ONLY a JSON array of lowercase nouns (max 10), no markdown: ["dog","park","grass"]';

/** Extract + clean the first [...] array from a model reply (tolerates ```json fences / prose). */
function extractTags(s: string): string[] {
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a === -1 || b === -1 || b < a) throw new Error("No JSON array in VLM reply");
  const arr = JSON.parse(s.slice(a, b + 1));
  if (!Array.isArray(arr)) throw new Error("VLM reply is not an array");
  const cleaned = arr
    .map((t: any) => String(t).toLowerCase().trim())
    .filter((t: string) => t.length > 0 && t.length < 30);
  return Array.from(new Set(cleaned));
}

export async function tagImage(imageUrl: string): Promise<string[]> {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return extractTags(content);
}

// --- self-check: node --experimental-strip-types -e "import('./lib/groq.ts').then(m=>m.demo())"
export function demo() {
  const fenced = extractTags('```json\n["Dog","PARK","dog"]\n```');
  console.assert(fenced.length === 2 && fenced.includes("dog") && fenced.includes("park"), "tags lowercased + deduped");
  const fromProse = extractTags('here you go: ["cat","sofa"] cheers');
  console.assert(fromProse.length === 2 && fromProse[0] === "cat", "extracts array from surrounding prose");
  console.log("groq demo OK", fenced, fromProse);
}
