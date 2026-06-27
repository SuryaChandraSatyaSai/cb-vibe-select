import dbConnect from "./db";
import ImageModel from "@/models/Image";
import { queryImageTags, queryObjectDetection } from "./hf";
import { extractImageMetrics } from "./metrics";

let isProcessing = false;

async function analyzeImage(imageDoc: any) {
  console.log(`[Queue] Analyzing image: ${imageDoc.filename} (${imageDoc.cloudinaryUrl})`);

  // 1. Objective quality + colour/lighting metrics from real pixels. This drives the
  //    score; if it throws the job is marked failed (no fabricated scores).
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
  imageDoc.qualityScore = metrics.qualityScore;
  console.log(`[Queue] Quality score for ${imageDoc.filename}: ${metrics.qualityScore}`);

  // 2. Best-effort enrichment: tags + object detection. These degrade to empty when
  //    HF serverless is unavailable rather than failing the job or inventing data.
  let imageBuffer: Buffer | null = null;
  try {
    const imgRes = await fetch(imageDoc.cloudinaryUrl);
    if (imgRes.ok) imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    else console.warn(`[Queue] Could not fetch image binary: ${imgRes.status} ${imgRes.statusText}`);
  } catch (err: any) {
    console.warn(`[Queue] Error fetching image binary for enrichment:`, err.message || err);
  }

  if (imageBuffer) {
    try {
      imageDoc.tags = await queryImageTags(imageBuffer);
    } catch (err: any) {
      console.warn(`[Queue] Tagging unavailable:`, err.message || err);
      imageDoc.tags = [];
    }
    imageDoc.objects = await queryObjectDetection(imageBuffer); // already returns [] on failure
  } else {
    imageDoc.tags = [];
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
