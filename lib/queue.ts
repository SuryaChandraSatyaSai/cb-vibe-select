import dbConnect from "./db";
import ImageModel from "@/models/Image";
import { queryAestheticScore, queryImageTags, queryObjectDetection } from "./hf";
import { extractImageMetrics } from "./metrics";

let isProcessing = false;

// Deterministic fallback generator when Hugging Face API key is missing or rate limited
function calculateFallbackAestheticScore(filename: string, fileSize: number): number {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = filename.charCodeAt(i) + ((hash << 5) - hash);
  }
  const factor = Math.abs(hash + fileSize) % 100; // 0 to 99
  const score = 5.5 + (3.4 * factor) / 99; // Scale to 5.5 - 8.9
  return Math.round(score * 10) / 10;
}

// Fallback tag parser that extracts tags from filename tokens
function parseFallbackTags(filename: string): string[] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const tokens = nameWithoutExt.split(/[\s_\-\.]+/);
  const tags = tokens
    .map((t) => t.toLowerCase().trim())
    .filter((t) => /^[a-z]{3,20}$/i.test(t) && !["img", "dsc", "photo", "image", "upload"].includes(t));
  
  tags.push("curated");
  return Array.from(new Set(tags));
}

async function analyzeImage(imageDoc: any) {
  console.log(`[Queue] Analyzing image: ${imageDoc.filename} (${imageDoc.cloudinaryUrl})`);
  
  // 1. Extract Custom Technical Image Metrics first
  let metrics: any = null;
  try {
    console.log(`[Queue] Extracting technical image metrics...`);
    metrics = await extractImageMetrics(imageDoc.cloudinaryUrl);
    imageDoc.attributes = metrics;
  } catch (err: any) {
    console.warn(`[Queue] Technical metrics extraction failed. Error:`, err.message || err);
    metrics = {
      brightness: 60,
      saturation: 45,
      temperature: "neutral",
      palette: ["#18181b", "#3f3f46", "#e4e4e7"],
      sharpness: 80
    };
    imageDoc.attributes = metrics;
  }

  let imageBuffer: Buffer | null = null;
  try {
    // Fetch image binary buffer from Cloudinary URL
    console.log(`[Queue] Fetching image binary from Cloudinary...`);
    const imgRes = await fetch(imageDoc.cloudinaryUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch image from Cloudinary: ${imgRes.statusText}`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error(`[Queue] Error fetching image binary:`, err.message || err);
  }

  // A. Aesthetic Scoring (Base score)
  let baseScore = 6.0;
  if (imageBuffer) {
    try {
      console.log(`[Queue] Querying Hugging Face for aesthetic scoring...`);
      const aestheticScore = await queryAestheticScore(imageBuffer);
      baseScore = aestheticScore;
      console.log(`[Queue] Baseline Aesthetic score for ${imageDoc.filename}: ${aestheticScore}`);
    } catch (err: any) {
      console.warn(`[Queue] HF aesthetic scoring failed. Falling back to local scoring. Error:`, err.message || err);
      baseScore = calculateFallbackAestheticScore(imageDoc.filename, imageDoc.fileSize);
    }
  } else {
    baseScore = calculateFallbackAestheticScore(imageDoc.filename, imageDoc.fileSize);
  }

  // Calculate penalties based on technical qualities
  let exposurePenalty = 0;
  let blurPenalty = 0;
  let oversaturationPenalty = 0;

  const brightness = metrics.brightness ?? 50;
  const sharpness = metrics.sharpness ?? 80;
  const saturation = metrics.saturation ?? 50;

  // Exposure Penalty:
  // Under-exposed (dark): brightness < 25
  if (brightness < 25) {
    exposurePenalty = (25 - brightness) * 0.12; // brightness=10 -> penalty=1.8
  }
  // Over-exposed (blown out): brightness > 85
  else if (brightness > 85) {
    exposurePenalty = (brightness - 85) * 0.15; // brightness=95 -> penalty=1.5
  }

  // Blur/Motion Penalty:
  // Sharpness < 35 indicates blur or very flat textures
  if (sharpness < 35) {
    blurPenalty = ((35 - sharpness) / 35) * 4.0; // sharpness=10 -> penalty=2.85
  }

  // Oversaturation Penalty:
  // Saturation > 90 indicates neon/artificial artifacts
  if (saturation > 90) {
    oversaturationPenalty = (saturation - 90) * 0.05; // max 0.5
  }

  // Apply penalties to compute final Quality Score
  const adjustedScore = baseScore - exposurePenalty - blurPenalty - oversaturationPenalty;
  imageDoc.qualityScore = Math.max(1.0, Math.min(10.0, Math.round(adjustedScore * 10) / 10));
  console.log(`[Queue] Final Refined Quality Score for ${imageDoc.filename}: ${imageDoc.qualityScore} (Base: ${baseScore}, ExposurePen: -${exposurePenalty.toFixed(2)}, BlurPen: -${blurPenalty.toFixed(2)}, SaturationPen: -${oversaturationPenalty.toFixed(2)})`);

  // B. Image Tagging (RAM++ / fallback classification models)
  if (imageBuffer) {
    try {
      console.log(`[Queue] Querying Hugging Face for image tagging...`);
      const tags = await queryImageTags(imageBuffer);
      imageDoc.tags = tags;
      console.log(`[Queue] Tags for ${imageDoc.filename}:`, tags);
    } catch (err: any) {
      console.warn(`[Queue] HF image tagging failed. Falling back to filename parser. Error:`, err.message || err);
      const fallbackTags = parseFallbackTags(imageDoc.filename);
      imageDoc.tags = fallbackTags;
    }
  } else {
    const fallbackTags = parseFallbackTags(imageDoc.filename);
    imageDoc.tags = fallbackTags;
  }

  // C. Object Detection (bounding boxes)
  if (imageBuffer) {
    try {
      console.log(`[Queue] Querying Hugging Face for object detection...`);
      const objects = await queryObjectDetection(imageBuffer);
      imageDoc.objects = objects;
      console.log(`[Queue] Object detection for ${imageDoc.filename} returned ${objects.length} objects.`);
    } catch (err: any) {
      console.warn(`[Queue] HF object detection failed. Error:`, err.message || err);
      imageDoc.objects = [];
    }
  } else {
    imageDoc.objects = [];
  }
}

export async function triggerQueueProcessing() {
  if (isProcessing) {
    console.log("[Queue] Queue processor is already running.");
    return;
  }

  isProcessing = true;
  console.log("[Queue] Starting background queue processor...");

  // Run asynchronously
  (async () => {
    try {
      await dbConnect();

      // Clean up/reset stuck jobs from previous aborted server runs (updated older than 5 mins)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stuckJobs = await ImageModel.updateMany(
        { status: "processing", updatedAt: { $lt: fiveMinutesAgo } },
        { $set: { status: "pending", analysisError: "Reset stuck processing job due to server timeout/restart." } }
      );
      if (stuckJobs.modifiedCount > 0) {
        console.log(`[Queue] Reset ${stuckJobs.modifiedCount} stuck processing jobs back to pending.`);
      }

      // Loop through all pending images
      while (true) {
        // Atomic update to mark next pending job as processing
        const image = await ImageModel.findOneAndUpdate(
          { status: "pending" },
          { $set: { status: "processing" } },
          { new: true, sort: { createdAt: 1 } } // process oldest first
        );

        if (!image) {
          console.log("[Queue] No more pending images. Queue idle.");
          break;
        }

        console.log(`[Queue] Processing image: ${image.filename} (ID: ${image._id})`);

        try {
          await analyzeImage(image);
          image.status = "completed";
          image.analysisError = undefined;
          await image.save();
          console.log(`[Queue] Successfully analyzed image: ${image.filename}`);
        } catch (error: any) {
          console.error(`[Queue] Failed to process image: ${image.filename}`, error);
          image.status = "failed";
          image.analysisError = error.message || "Unknown error during analysis.";
          await image.save();
        }
      }
    } catch (err) {
      console.error("[Queue] Error in background processor run:", err);
    } finally {
      isProcessing = false;
      console.log("[Queue] Background queue processor finished.");
    }
  })();
}
