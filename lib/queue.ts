import dbConnect from "./db";
import ImageModel from "@/models/Image";
import { judgeImage } from "./groq";
import { extractImageMetrics } from "./metrics";

let isProcessing = false;

async function analyzeImage(imageDoc: any) {
  console.log(`[Queue] Analyzing image: ${imageDoc.filename} (${imageDoc.cloudinaryUrl})`);

  // 1. Objective colour/lighting/focus metrics from real pixels — always free, always
  //    runs. Powers the gallery filters and is the fallback score. If it throws the
  //    job is marked failed (no fabricated data).
  const metrics = await extractImageMetrics(imageDoc.cloudinaryUrl);
  imageDoc.attributes = {
    brightness: metrics.brightness,
    contrast: metrics.contrast,
    saturation: metrics.saturation,
    colorfulness: metrics.colorfulness,
    temperature: metrics.temperature,
    palette: metrics.palette,
    sharpness: metrics.sharpness,
  };

  // 2. Quality score + tags from the free Groq vision judge (most accurate — it
  //    actually sees blur/exposure). On any failure (rate limit, outage, no key) fall
  //    back to the local metric score so the pipeline never blocks or fabricates.
  try {
    const j = await judgeImage(imageDoc.cloudinaryUrl);
    imageDoc.qualityScore = j.qualityScore;
    imageDoc.qualityReason = j.reason || undefined;
    imageDoc.tags = j.tags;
    console.log(`[Queue] Groq score for ${imageDoc.filename}: ${j.qualityScore} (${j.reason})`);
  } catch (err: any) {
    console.warn(`[Queue] Groq judge unavailable, using local metric score:`, err.message || err);
    imageDoc.qualityScore = metrics.qualityScore;
    imageDoc.qualityReason = undefined;
    imageDoc.tags = [];
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
