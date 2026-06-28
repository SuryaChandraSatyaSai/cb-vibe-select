import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import ImageModel from "@/models/Image";
import { auth } from "@/auth";
import { triggerQueueProcessing } from "@/lib/queue";

// GET /api/images - Retrieve all image records
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    let images;
    if (search) {
      console.log(`[Images API] Searching catalog for query: "${search}"`);
      const populatePeople = { path: "people.personId", select: "name title links avatarUrl" };
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex metachars

      // (a) relevance full-text search over indexed fields (filename / originalPath / tags)
      const textHits = await ImageModel.find(
        { $text: { $search: search } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .populate(populatePeople);

      // (b) recognized-person matches. people.name isn't in the text index, and $text can't be
      //     combined with $or, so this runs separately: match the whole phrase OR any word
      //     (>= 3 chars) so a natural query like "hem at office" still surfaces "Hem".
      const tokens = Array.from(new Set(search.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 3)));
      const nameOr = [esc(search), ...tokens.map(esc)].map((p) => ({ "people.name": new RegExp(p, "i") }));
      const nameHits = await ImageModel.find({ $or: nameOr }).sort({ createdAt: -1 }).populate(populatePeople);

      // merge: person matches first (most specific), then text hits, deduped by id
      const byId = new Map<string, any>();
      for (const img of [...nameHits, ...textHits]) byId.set(String(img._id), img);
      images = Array.from(byId.values());

      // (c) last-resort substring search (e.g. "IMG_12") only if nothing matched above
      if (images.length === 0) {
        console.log(`[Images API] No text/name matches. Running regex substring fallback for: "${search}"`);
        const regex = new RegExp(esc(search), "i");
        images = await ImageModel.find({
          $or: [
            { filename: regex },
            { originalPath: regex },
            { tags: { $in: [regex] } },
            { "people.name": regex },
          ],
        })
          .sort({ createdAt: -1 })
          .populate(populatePeople);
      }
    } else {
      // Return all images sorted by creation date descending
      images = await ImageModel.find({})
        .sort({ createdAt: -1 })
        .populate({ path: "people.personId", select: "name title links avatarUrl" });
    }

    // If any image is pending or processing, trigger the queue processing to make sure worker is active
    const hasActiveJobs = images.some((img) => img.status === "pending" || img.status === "processing");
    if (hasActiveJobs) {
      triggerQueueProcessing();
    }

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (err: any) {
    console.error("Error fetching images:", err);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve image records", error: err.message },
      { status: 500 }
    );
  }
}

// DELETE /api/images - Reset DB and delete assets from Cloudinary
export async function DELETE() {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  // Authorize only ADMIN roles to reset the media library
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json(
      { success: false, message: "Forbidden. Only Administrators can reset the library." },
      { status: 403 }
    );
  }

  try {
    await dbConnect();
    
    // Retrieve all records to grab Cloudinary Public IDs
    const images = await ImageModel.find({});
    const publicIds = images
      .map((img) => img.cloudinaryPublicId)
      .filter((id): id is string => !!id);

    if (publicIds.length > 0) {
      // Batch delete from Cloudinary (API supports up to 100 resources per call)
      // We chunk them in sets of 100 just in case
      const chunkSize = 100;
      for (let i = 0; i < publicIds.length; i += chunkSize) {
        const chunk = publicIds.slice(i, i + chunkSize);
        await new Promise((resolve, reject) => {
          cloudinary.api.delete_resources(chunk, (error, result) => {
            if (error) {
              console.error("Cloudinary delete error:", error);
              return reject(error);
            }
            resolve(result);
          });
        });
      }
    }

    // Clear MongoDB collection
    await ImageModel.deleteMany({});

    return NextResponse.json({
      success: true,
      message: `Cleared ${images.length} images from database and Cloudinary.`,
    });
  } catch (err: any) {
    console.error("Error clearing library:", err);
    return NextResponse.json(
      { success: false, message: "Failed to clear library", error: err.message },
      { status: 500 }
    );
  }
}

// POST /api/images - Reprocess / Re-analyze an image
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  try {
    await dbConnect();
    const { imageId } = await request.json();
    if (!imageId) {
      return NextResponse.json(
        { success: false, message: "Missing imageId parameter" },
        { status: 400 }
      );
    }

    const img = await ImageModel.findById(imageId);
    if (!img) {
      return NextResponse.json(
        { success: false, message: "Image record not found" },
        { status: 404 }
      );
    }

    // Reset status to pending and clear errors
    img.status = "pending";
    img.analysisError = undefined;
    await img.save();

    // Trigger queue processing worker
    triggerQueueProcessing();

    return NextResponse.json({
      success: true,
      message: `Re-queued image ${img.filename} for analysis.`,
      image: img
    });
  } catch (err: any) {
    console.error("Error reprocessing image:", err);
    return NextResponse.json(
      { success: false, message: "Failed to reprocess image", error: err.message },
      { status: 500 }
    );
  }
}
