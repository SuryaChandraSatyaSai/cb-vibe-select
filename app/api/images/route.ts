import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "@/lib/db";
import ImageModel from "@/models/Image";
import { auth } from "@/auth";
import { triggerQueueProcessing } from "@/lib/queue";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET /api/images - Retrieve all image records
export async function GET() {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  try {
    await dbConnect();
    const images = await ImageModel.find({}).sort({ createdAt: -1 });

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
