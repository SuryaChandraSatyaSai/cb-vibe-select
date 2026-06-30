// No-Reference Image Quality Assessment, in-process, via CLIP-IQA (transformers.js).
// Zero-shot: CLIP scores the image against antonym prompt pairs and the per-pair softmax
// probability of the "good" side is averaged into a 0-1 quality. No training, no GPU, no
// second server — the CLIP model (ONNX) auto-downloads from HF once and is cached to disk,
// exactly like face-api loads its weights.
//
// A single "Good photo."/"Bad photo." pair (the original CLIP-IQA) leans aesthetic: it
// rewards nice subjects/scenery and underrates clean-but-plain shots, so a soft scenic
// photo can outscore a sharp boring one. We mitigate this two ways: (1) pairs that target
// TECHNICAL quality (sharpness, clarity, noise) instead of "good/bad"; (2) blending the
// result with the measured variance-of-Laplacian sharpness (lib/metrics), which CLIP is
// weak at. CLIP catches noise/exposure/semantics; the Laplacian catches focus.
// (Interpretable IQA via CLIP, arXiv:2308.13094.)
//
// ponytail: zero-shot ceiling ~0.8 SRCC vs human MOS. If that's not enough, the upgrade
// path is a learned NR-IQA (MUSIQ/MANIQA) exported to ONNX behind the same
// scoreImageQuality() — the queue contract doesn't change.

import { pipeline, type DataType } from "@huggingface/transformers";

const MODEL = process.env.IQA_MODEL || "Xenova/clip-vit-base-patch16";

// [good, bad] antonym pairs, all technical-quality (not aesthetic). Score = mean P(good).
const PAIRS: [string, string][] = [
  ["A sharp, in-focus photo.", "A blurry, out-of-focus photo."],
  ["A high quality photo.", "A low quality photo."],
  ["A clear, detailed photo.", "A noisy, pixelated photo."],
];

export interface IqaResult {
  qualityScore: number; // 1-10 — CLIP technical quality blended with sharpness (when provided)
  good: number; // mean P(good) across pairs, 0-1 (CLIP only)
}

// How much measured focus/sharpness counts vs CLIP. ponytail: 50/50; raise SHARP_WEIGHT
// if you want clarity/focus to dominate more (it's the signal humans read as "quality").
const SHARP_WEIGHT = 0.5;

// lazy singleton (like lib/db.ts / lib/face.ts): load the model once per process.
// q8 (quantized) weights: fp32 CLIP-ViT-B/16 is ~600MB in RAM and OOM-kills a 512MB-2GB host
// alongside tfjs/face-api/canvas. q8 is ~150MB for a small accuracy cost. Override via IQA_DTYPE
// (set "fp32" for max accuracy only if the host has the RAM headroom).
let pipe: Promise<any> | null = null;
const classifier = () =>
  (pipe ??= pipeline("zero-shot-image-classification", MODEL, { dtype: (process.env.IQA_DTYPE as DataType) || "q8" }));

export const to10 = (v: number) => Math.round((1 + Math.max(0, Math.min(1, v)) * 9) * 10) / 10; // 0-1 -> 1-10

// CLIP downsamples to 224px internally, so a small copy is plenty and saves bandwidth.
function analysisUrl(cloudinaryUrl: string): string {
  return cloudinaryUrl.includes("/upload/")
    ? cloudinaryUrl.replace("/upload/", "/upload/c_limit,w_512/")
    : cloudinaryUrl;
}

/** Score an image 1-10. Pass the measured sharpness (0-100, from lib/metrics) to blend in
 *  focus — CLIP alone rates a soft scenic photo above a sharp plain one. */
export async function scoreImageQuality(cloudinaryUrl: string, sharpness?: number): Promise<IqaResult> {
  const clf = await classifier();
  const url = analysisUrl(cloudinaryUrl);
  // Per-pair softmax (CLIP-IQA's method), then average. hypothesis_template "{}" encodes
  // the prompts verbatim instead of the pipeline's default "This is a photo of {}." wrapper.
  // ponytail: re-encodes the image once per pair (3x); fine for a background queue. Drop to
  // the lower-level CLIPModel API to encode the image once if throughput ever matters.
  let sum = 0;
  for (const [good, bad] of PAIRS) {
    const out: Array<{ label: string; score: number }> = await clf(url, [good, bad], { hypothesis_template: "{}" });
    const p = out.find((o) => o.label === good)?.score;
    if (typeof p !== "number") throw new Error("CLIP-IQA returned no score");
    sum += p;
  }
  const good = sum / PAIRS.length;
  const quality =
    typeof sharpness === "number"
      ? (1 - SHARP_WEIGHT) * good + SHARP_WEIGHT * Math.max(0, Math.min(1, sharpness / 100))
      : good;
  return { qualityScore: to10(quality), good };
}

// --- self-check (mapping only; model download is heavy, run scoreImageQuality for e2e):
//     node --experimental-strip-types -e "import('./lib/iqa.ts').then(m=>m.demo())"
export function demo() {
  console.assert(to10(0) === 1, "P(good)=0 -> 1");
  console.assert(to10(1) === 10, "P(good)=1 -> 10");
  console.assert(to10(0.5) === 5.5, "P(good)=0.5 -> 5.5");
  console.log("iqa mapping OK");
}
