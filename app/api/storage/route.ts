import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/auth";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET() {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  try {
    const usage = await cloudinary.api.usage();
    
    // Resolve storage limit (defaulting to credits limit in GB converted to bytes, or 25 GB)
    const limit = usage.storage.limit || (usage.credits?.limit ? usage.credits.limit * 1024 * 1024 * 1024 : 25 * 1024 * 1024 * 1024);
    const used = usage.storage.usage || 0;
    const free = limit - used;
    const usedPercent = usage.storage.used_percent !== undefined ? usage.storage.used_percent : (limit > 0 ? (used / limit) * 100 : 0);

    return NextResponse.json({
      success: true,
      plan: usage.plan,
      storage: {
        used,
        limit,
        usedPercent,
        free,
      },
    });
  } catch (err: any) {
    console.error("Error fetching Cloudinary usage:", err);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve storage metrics", error: err.message },
      { status: 500 }
    );
  }
}
