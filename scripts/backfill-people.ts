// One-time back-fill: re-run face recognition on every existing image and store matches.
// Needed for images uploaded BEFORE people were seeded (their `people` is empty). New uploads
// are recognized automatically by the queue. Safe to re-run; only updates the `people` field.
//
// Run: node --experimental-strip-types scripts/backfill-people.ts
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const { default: dbConnect } = await import("../lib/db.ts");
  const { default: PersonModel } = await import("../models/Person.ts");
  const { default: ImageModel } = await import("../models/Image.ts");
  const { buildMatcher, recognizeFaces, fetchAnalysisBuffer } = await import("../lib/face.ts");
  const mongoose = (await import("mongoose")).default;

  await dbConnect();

  const people = await PersonModel.find({}, "name descriptors").lean();
  const idToName = new Map((people as any[]).map((p) => [String(p._id), p.name as string]));
  const matcher = buildMatcher((people as any[]).map((p) => ({ id: String(p._id), descriptors: p.descriptors })));
  if (!matcher) {
    console.log("No people seeded — run scripts/seed-people.ts first.");
    await mongoose.connection.close();
    return;
  }

  const images = await ImageModel.find({});
  let updated = 0;
  for (const img of images) {
    try {
      const buf = await fetchAnalysisBuffer(img.cloudinaryUrl);
      const matches = await recognizeFaces(buf, matcher);
      img.people = matches
        .filter((m) => idToName.has(m.personId))
        .map((m) => ({ personId: m.personId as any, name: idToName.get(m.personId)!, distance: m.distance, box: m.box }));
      await img.save();
      const shown = img.people.map((p: any) => `${p.name} ${Math.round((1 - p.distance) * 100)}%`).join(", ") || "none";
      console.log(`${img.filename}: ${img.people.length} match(es) [${shown}]`);
      updated++;
    } catch (err: any) {
      console.warn(`${img.filename}: ERROR ${err.message || err}`);
    }
  }

  console.log(`\nBack-filled ${updated}/${images.length} images.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
