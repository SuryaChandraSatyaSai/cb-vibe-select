// No-Reference Image Quality Assessment, in-process, via CLIP-IQA (transformers.js).
// Zero-shot: CLIP scores the image against the antonym prompts "Good photo." / "Bad
// photo."; the softmax probability of "Good photo." is the quality (0-1). No training,
// no GPU, no second server — the CLIP model (ONNX) auto-downloads from HF once and is
// cached to disk, exactly like face-api loads its weights. CLIP-IQA is SOTA among
// opinion-unaware (zero-shot) NR-IQA methods on KonIQ-10k, and far better calibrated
// to human judgement than the local Laplacian heuristic or an LLM grading a number.
//
// ponytail: zero-shot ceiling ~0.81 SRCC vs human MOS. If that's not enough, the upgrade
// path is a learned head (CLIP-IQA+ / a trained NR-IQA exported to ONNX) behind the same
// scoreImageQuality() — the queue contract doesn't change.

import { pipeline } from "@huggingface/transformers";

const MODEL = process.env.IQA_MODEL || "Xenova/clip-vit-base-patch16";
const GOOD = "Good photo.";
const BAD = "Bad photo.";

export interface IqaResult {
  qualityScore: number; // 1-10
  good: number; // raw P(good) 0-1
}

// lazy singleton (like lib/db.ts / lib/face.ts): load the model once per process.
// fp32 over the default quantized weights — we're optimising for accuracy, not size.
let pipe: Promise<any> | null = null;
const classifier = () =>
  (pipe ??= pipeline("zero-shot-image-classification", MODEL, { dtype: "fp32" }));

export const to10 = (v: number) => Math.round((1 + Math.max(0, Math.min(1, v)) * 9) * 10) / 10; // 0-1 -> 1-10

// CLIP downsamples to 224px internally, so a small copy is plenty and saves bandwidth.
function analysisUrl(cloudinaryUrl: string): string {
  return cloudinaryUrl.includes("/upload/")
    ? cloudinaryUrl.replace("/upload/", "/upload/c_limit,w_512/")
    : cloudinaryUrl;
}

export async function scoreImageQuality(cloudinaryUrl: string): Promise<IqaResult> {
  const clf = await classifier();
  // hypothesis_template "{}" => encode the prompts verbatim (CLIP-IQA's antonym pair),
  // instead of the pipeline's default "This is a photo of {}." wrapper.
  const out: Array<{ label: string; score: number }> = await clf(
    analysisUrl(cloudinaryUrl),
    [GOOD, BAD],
    { hypothesis_template: "{}" }
  );
  const good = out.find((o) => o.label === GOOD)?.score;
  if (typeof good !== "number") throw new Error("CLIP-IQA returned no score");
  return { qualityScore: to10(good), good };
}

// --- self-check (mapping only; model download is heavy, run scoreImageQuality for e2e):
//     node --experimental-strip-types -e "import('./lib/iqa.ts').then(m=>m.demo())"
export function demo() {
  console.assert(to10(0) === 1, "P(good)=0 -> 1");
  console.assert(to10(1) === 10, "P(good)=1 -> 10");
  console.assert(to10(0.5) === 5.5, "P(good)=0.5 -> 5.5");
  console.log("iqa mapping OK");
}
