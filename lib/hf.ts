const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || "";

// Legacy api-inference.huggingface.co was retired (late 2025) → use the router.
// Best-effort only: image models are often cold/unavailable on serverless, so callers
// must tolerate failure. The quality score does NOT depend on these (see lib/metrics.ts);
// tags + objects are enrichment that degrade to empty, never to fabricated data.
const HF_BASE = "https://router.huggingface.co/hf-inference/models";

// The router enforces a real image content-type (octet-stream is rejected for
// object-detection). Sniff it from the buffer's magic bytes.
function imageMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

async function hfInfer(modelId: string, imageBuffer: Buffer): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": imageMime(imageBuffer) };
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;

  const response = await fetch(`${HF_BASE}/${modelId}`, {
    headers,
    method: "POST",
    body: new Uint8Array(imageBuffer),
  });
  if (!response.ok) {
    throw new Error(`HF Inference API returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/**
 * Image tagging. Tries RAM++ then standard classifiers; returns [] only if all fail
 * (the caller logs that and stores no tags rather than inventing them).
 */
export async function queryImageTags(imageBuffer: Buffer): Promise<string[]> {
  // ponytail: RAM++ (xinyu1205/recognize-anything-plus-model) isn't served by any HF
  // inference provider, so it's omitted — these classifiers are live on hf-inference.
  const models = [
    "google/vit-base-patch16-224",
    "microsoft/resnet-50",
  ];

  let lastError: any = null;
  for (const id of models) {
    try {
      console.log(`[HF API] Querying image tags model: ${id}...`);
      const data = await hfInfer(id, imageBuffer);

      let tags: string[] = [];
      if (Array.isArray(data)) {
        tags = data
          .filter((item: any) => typeof item.label === "string" && (item.score === undefined || item.score > 0.12))
          .map((item: any) => item.label.toLowerCase().trim());
      } else if (typeof data === "string") {
        tags = data.split(",").map((t) => t.trim().toLowerCase());
      } else if (data && typeof data.tags === "string") {
        tags = data.tags.split(",").map((t: string) => t.trim().toLowerCase());
      } else if (data && Array.isArray(data.tags)) {
        tags = data.tags.map((t: any) => String(t).trim().toLowerCase());
      }

      const uniqueTags = Array.from(new Set(tags))
        .map((t) => t.split(",")[0].trim())
        .filter((t) => t.length > 0 && t.length < 30);
      if (uniqueTags.length > 0) return uniqueTags;
    } catch (err: any) {
      console.warn(`[HF API] Tag model ${id} failed:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("All Hugging Face tagging models failed to execute.");
}

/**
 * Object detection with bounding boxes (facebook/detr-resnet-50).
 * Returns [] on any failure — bounding boxes are optional overlay data.
 */
export async function queryObjectDetection(imageBuffer: Buffer): Promise<any[]> {
  try {
    console.log(`[HF API] Querying object detection model: facebook/detr-resnet-50...`);
    const data = await hfInfer("facebook/detr-resnet-50", imageBuffer);
    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => typeof item.score === "number" && item.score >= 0.55 && item.box)
      .map((item: any) => ({
        label: String(item.label).toLowerCase().trim(),
        score: Math.round(item.score * 100) / 100,
        box: {
          xmin: Math.round(item.box.xmin),
          ymin: Math.round(item.box.ymin),
          xmax: Math.round(item.box.xmax),
          ymax: Math.round(item.box.ymax),
        },
      }));
  } catch (err: any) {
    console.warn("[HF API] Object detection failed:", err.message || err);
    return [];
  }
}
