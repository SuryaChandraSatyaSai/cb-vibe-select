// Free image-quality judge via Groq's free tier (no credit card; ~1000 req/day,
// so 500/month is comfortably free). One multimodal call returns an overall 1-10
// quality score, a short reason, and object/scene tags. Falls back to local pixel
// metrics in the queue if this is rate-limited or unavailable — never blocks.

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface VlmJudgement {
  qualityScore: number; // 1-10 overall usable quality
  reason: string; // short human-readable justification
  tags: string[]; // object + scene keywords
}

const PROMPT =
  "You are a strict professional photo-quality grader for a curation library where " +
  "users want the sharpest, best-lit, best-composed shots. Rate the image and reply " +
  "with ONLY JSON, no markdown:\n" +
  '{"overall":<1-10>,"reason":"<max 12 words>","tags":["lowercase nouns: objects + scene, max 10"]}\n' +
  "Heavily penalise blur/out-of-focus and bad exposure. 'overall' must reflect real usable quality.";

/** Extract the first {...} block from a model reply (tolerates ```json fences / prose). */
function extractJson(s: string): any {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) throw new Error("No JSON object in VLM reply");
  return JSON.parse(s.slice(a, b + 1));
}

function normalize(j: any): VlmJudgement {
  const n = Number(j.overall);
  const qualityScore = Number.isFinite(n) ? Math.round(Math.max(1, Math.min(10, n)) * 10) / 10 : 5;
  const rawTags: string[] = Array.isArray(j.tags)
    ? j.tags.map((t: any) => String(t).toLowerCase().trim()).filter((t: string) => t.length > 0 && t.length < 30)
    : [];
  const tags = Array.from(new Set(rawTags));
  return { qualityScore, reason: typeof j.reason === "string" ? j.reason.slice(0, 140) : "", tags };
}

export async function judgeImage(imageUrl: string): Promise<VlmJudgement> {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 300,
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
  return normalize(extractJson(content));
}

// --- self-check: node --experimental-strip-types -e "import('./lib/groq.ts').then(m=>m.demo())"
export function demo() {
  const fenced = '```json\n{"overall": 12, "reason": "Sharp and bright", "tags":["Dog","PARK","dog"]}\n```';
  const j = normalize(extractJson(fenced));
  console.assert(j.qualityScore === 10, "overall clamps to 10");
  console.assert(j.reason === "Sharp and bright", "reason parsed");
  console.assert(j.tags.length === 2 && j.tags.includes("dog") && j.tags.includes("park"), "tags lowercased + deduped");
  const blurry = normalize(extractJson('prose {"overall":2,"reason":"Out of focus","tags":[]} trailing'));
  console.assert(blurry.qualityScore === 2, "extracts JSON from surrounding prose");
  console.log("groq demo OK", j, blurry);
}
