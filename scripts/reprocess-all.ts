// Re-score every catalogued image with the current quality scorer (CLIP-IQA, lib/iqa.ts).
// Only the score changed, so this ONLY rewrites qualityScore (+ clears the stale reason);
// tags, people and pixel attributes are left untouched. Same honest fallback as the queue:
// CLIP-IQA -> local pixel metric -> count as failed (never fabricates).
//
// Run:  node --experimental-strip-types scripts/reprocess-all.ts
// Safe to re-run; loads .env.local like the app (dynamic imports after env is loaded).

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const { default: dbConnect } = await import("../lib/db.ts");
  const { default: ImageModel } = await import("../models/Image.ts");
  const { scoreImageQuality } = await import("../lib/iqa.ts");
  const { extractImageMetrics } = await import("../lib/metrics.ts");
  const mongoose = (await import("mongoose")).default;

  await dbConnect();
  const images = await ImageModel.find({}, "filename cloudinaryUrl qualityScore");
  console.log(`Re-scoring ${images.length} image(s) with CLIP-IQA...\n`);

  let ok = 0, fellBack = 0, failed = 0;
  for (const img of images) {
    let score: number;
    let fallback = false;
    try {
      // Metrics first (always free) so we can blend sharpness into the CLIP score, and so
      // it's the honest fallback if CLIP fails. Matches the queue's pipeline.
      const m = await extractImageMetrics(img.cloudinaryUrl);
      try {
        score = (await scoreImageQuality(img.cloudinaryUrl, m.sharpness)).qualityScore;
      } catch {
        score = m.qualityScore;
        fallback = true;
      }
    } catch (e2: any) {
      failed++;
      console.error(`FAIL ${img.filename}: ${e2.message || e2}`);
      continue;
    }
    await ImageModel.updateOne({ _id: img._id }, { $set: { qualityScore: score } });
    ok++;
    if (fallback) fellBack++;
    console.log(`${fallback ? "WARN" : "OK  "} ${img.filename}: ${img.qualityScore ?? "?"} -> ${score}${fallback ? " (local fallback)" : ""}`);
  }

  console.log(`\nDone: ${ok} re-scored (${fellBack} via local fallback), ${failed} failed.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
