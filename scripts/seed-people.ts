// Seed known people into Cloudinary + MongoDB so uploads can be matched against them.
//
// 1. Drop avatar images (one clear face each) into seed/avatars/
// 2. Edit seed/people.json: [{ file, name, title?, bio?, links?: [{label?, url}] }]
// 3. Run:  node --experimental-strip-types scripts/seed-people.ts
//
// Re-running is safe: people are upserted by name and avatars overwrite by public_id.

import { readFileSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env"; // CommonJS module: default-import then destructure
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

// Load .env.local exactly like the app does. Must happen before lib/db.ts is evaluated —
// it reads process.env.MONGODB_URI at module top — so db/Person/face are dynamic-imported
// inside main() (static imports are hoisted above this line and would run too early).
nextEnv.loadEnvConfig(process.cwd());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function uploadAvatar(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "vibeselect/people", public_id: publicId, overwrite: true, resource_type: "image" },
        (err, result) => (err ? reject(err) : resolve(result!.secure_url))
      )
      .end(buffer);
  });
}

async function main() {
  const { default: dbConnect } = await import("../lib/db.ts");
  const { default: PersonModel } = await import("../models/Person.ts");
  const { computeDescriptor } = await import("../lib/face.ts");

  const seedDir = path.join(process.cwd(), "seed");
  const people: Array<{ file?: string; files?: string[]; name: string; title?: string; bio?: string; links?: any[] }> =
    JSON.parse(readFileSync(path.join(seedDir, "people.json"), "utf8"));

  if (!people.length) {
    console.log("seed/people.json is empty — nothing to seed.");
    return;
  }

  await dbConnect();
  let ok = 0;

  for (const p of people) {
    try {
      const files = p.files?.length ? p.files : p.file ? [p.file] : [];
      if (!files.length) {
        console.warn(`SKIP "${p.name}": no file(s) listed`);
        continue;
      }
      // One descriptor per photo; more angles -> better recall. A missing file or a photo with
      // no detectable face is skipped individually (doesn't drop the whole person).
      const descriptors: number[][] = [];
      for (const f of files) {
        try {
          const d = await computeDescriptor(readFileSync(path.join(seedDir, "avatars", f)));
          if (d) descriptors.push(d);
          else console.warn(`  no face detected in ${f} (skipped)`); // honest: no bogus descriptor
        } catch (e: any) {
          console.warn(`  cannot read ${f}: ${e.message || e} (skipped)`);
        }
      }
      if (!descriptors.length) {
        console.warn(`SKIP "${p.name}": no faces detected in any photo`);
        continue;
      }
      const avatarPublicId = `vibeselect/people/${slug(p.name)}`;
      const avatarUrl = await uploadAvatar(readFileSync(path.join(seedDir, "avatars", files[0])), slug(p.name));
      await PersonModel.findOneAndUpdate(
        { name: p.name },
        { $set: { name: p.name, title: p.title, bio: p.bio, links: p.links, avatarPublicId, avatarUrl, descriptors } },
        { upsert: true, new: true }
      );
      console.log(`OK   "${p.name}" (${descriptors.length} reference face${descriptors.length > 1 ? "s" : ""})`);
      ok++;
    } catch (err: any) {
      console.warn(`SKIP "${p.name}": ${err.message || err}`);
    }
  }

  console.log(`\nSeeded ${ok}/${people.length} people.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
