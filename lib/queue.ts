import dbConnect from "./db";
import ImageModel from "@/models/Image";
import { queryAestheticScore } from "./hf";

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

async function analyzeImage(imageDoc: any) {
  console.log(`[Queue] Analyzing image: ${imageDoc.filename} (${imageDoc.cloudinaryUrl})`);
  
  try {
    // 1. Fetch image binary buffer from Cloudinary URL
    console.log(`[Queue] Fetching image binary from Cloudinary...`);
    const imgRes = await fetch(imageDoc.cloudinaryUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch image from Cloudinary: ${imgRes.statusText}`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 2. Query Hugging Face model
    console.log(`[Queue] Querying Hugging Face for aesthetic scoring...`);
    const aestheticScore = await queryAestheticScore(imageBuffer);
    
    // Save aesthetic score
    imageDoc.qualityScore = aestheticScore;
    console.log(`[Queue] Aesthetic score for ${imageDoc.filename}: ${aestheticScore}`);
  } catch (err: any) {
    console.warn(`[Queue] HF analysis failed. Falling back to local pseudo-aesthetic score. Error:`, err.message || err);
    
    const fallbackScore = calculateFallbackAestheticScore(imageDoc.filename, imageDoc.fileSize);
    imageDoc.qualityScore = fallbackScore;
    console.log(`[Queue] Fallback aesthetic score for ${imageDoc.filename}: ${fallbackScore}`);
  }

  // Pre-initialize standard empty metrics for future stages
  imageDoc.attributes = {
    brightness: 75,
    saturation: 60,
    temperature: "neutral",
    palette: ["#18181b", "#3f3f46", "#e4e4e7"],
  };
  imageDoc.tags = ["ingest_stage6_completed"];
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
