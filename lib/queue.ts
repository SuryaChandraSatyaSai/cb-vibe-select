import dbConnect from "./db";
import ImageModel from "@/models/Image";
import PersonModel from "@/models/Person";
import { judgeImage } from "./groq";
import { extractImageMetrics } from "./metrics";
import { buildMatcher, recognizeFaces, fetchAnalysisBuffer } from "./face";

let isProcessing = false;

async function analyzeImage(imageDoc: any, matcher: any, idToName: Map<string, string>) {
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

  // 3. Recognize seeded people (self-hosted face-api). Like the Groq step, this never blocks
  //    and never fabricates: no seeded people / no match / any failure -> empty `people`.
  try {
    if (!matcher) {
      imageDoc.people = [];
    } else {
      const buf = await fetchAnalysisBuffer(imageDoc.cloudinaryUrl);
      const matches = await recognizeFaces(buf, matcher);
      imageDoc.people = matches
        .filter((m) => idToName.has(m.personId))
        .map((m) => ({ personId: m.personId, name: idToName.get(m.personId)!, distance: m.distance, box: m.box }));
      console.log(`[Queue] Recognized ${imageDoc.people.length} person(s) in ${imageDoc.filename}`);
    }
  } catch (err: any) {
    console.warn(`[Queue] Face recognition unavailable for ${imageDoc.filename}:`, err.message || err);
    imageDoc.people = [];
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

      // Build the face matcher once for this run from all seeded people. Models load lazily
      // on the first recognised image; if nobody is seeded, matcher is null and we skip faces.
      const seededPeople = await PersonModel.find({}, "name descriptors").lean();
      const idToName = new Map(seededPeople.map((p: any) => [String(p._id), p.name as string]));
      const matcher = buildMatcher(seededPeople.map((p: any) => ({ id: String(p._id), descriptors: p.descriptors })));
      console.log(`[Queue] Face matcher: ${matcher ? `${seededPeople.length} seeded people` : "no people seeded, skipping recognition"}.`);

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
          await analyzeImage(image, matcher, idToName);
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
