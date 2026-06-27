import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import AdmZip from "adm-zip";
import crypto from "crypto";
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
 
// Configure Limits from Environment Variables
const MAX_ZIP_SIZE = (parseInt(process.env.MAX_ZIP_SIZE_MB || "50") * 1024 * 1024);
const MAX_IMAGE_SIZE = (parseInt(process.env.MAX_IMAGE_SIZE_MB || "10") * 1024 * 1024);
const MAX_PROCESSING_TIME = (parseInt(process.env.MAX_PROCESSING_TIME_SECONDS || "60") * 1000);
 
// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: filename.replace(/\.[^/.]+$/, ""), // remove extension
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned empty result"));
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};
 
// Check if a file extension is an image
const isImageFile = (filename: string): boolean => {
  return /\.(jpe?g|png|webp|gif)$/i.test(filename);
};
 
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in to perform this action." },
      { status: 401 }
    );
  }
  const userEmail = session.user.email;
 
  try {
    await dbConnect();
  } catch (dbError: any) {
    console.error("Database connection error:", dbError);
    return NextResponse.json(
      { success: false, message: "Database connection failed", error: dbError.message },
      { status: 500 }
    );
  }
 
  const startTime = Date.now();
  
  // Basic content length validation if header exists
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_ZIP_SIZE + 10 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, message: `Payload size exceeds max zip size limit.` },
      { status: 413 }
    );
  }
 
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Invalid form data.", error: err.message },
      { status: 400 }
    );
  }
 
  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return NextResponse.json(
      { success: false, message: "No files found in upload request." },
      { status: 400 }
    );
  }
 
  const todayStr = new Date().toISOString().split("T")[0];
  const cloudinaryFolder = `vibeselect/${todayStr}`;
 
  const uploadedRecords: any[] = [];
  const skippedRecords: any[] = [];
  let isTimedOut = false;
 
  // Flatten and prepare files to process (either direct images or extracted zip entries)
  const itemsToProcess: {
    filename: string;
    originalPath: string;
    buffer: Buffer;
    size: number;
  }[] = [];
 
  for (const file of files) {
    const isZip = file.name.endsWith(".zip") || file.type === "application/zip";
    
    if (isZip) {
      if (file.size > MAX_ZIP_SIZE) {
        skippedRecords.push({
          filename: file.name,
          reason: `ZIP file exceeds maximum limit of ${process.env.MAX_ZIP_SIZE_MB || "50"}MB.`,
        });
        continue;
      }
 
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = new AdmZip(Buffer.from(arrayBuffer));
        const entries = zip.getEntries();
 
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          
          if (!isImageFile(entry.entryName)) continue;
 
          const entrySize = entry.header.size;
          if (entrySize > MAX_IMAGE_SIZE) {
            skippedRecords.push({
              filename: entry.name,
              reason: `File "${entry.entryName}" inside ZIP exceeds maximum image limit of ${process.env.MAX_IMAGE_SIZE_MB || "10"}MB.`,
            });
            continue;
          }
 
          itemsToProcess.push({
            filename: entry.name,
            originalPath: entry.entryName,
            buffer: entry.getData(),
            size: entrySize,
          });
        }
      } catch (zipErr: any) {
        console.error("ZIP processing error:", zipErr);
        skippedRecords.push({
          filename: file.name,
          reason: `Failed to extract ZIP archive: ${zipErr.message}`,
        });
      }
    } else {
      // Direct image upload
      if (!isImageFile(file.name)) {
        skippedRecords.push({
          filename: file.name,
          reason: "Unsupported file format. Only images (JPG, PNG, WEBP, GIF) are allowed.",
        });
        continue;
      }
 
      if (file.size > MAX_IMAGE_SIZE) {
        skippedRecords.push({
          filename: file.name,
          reason: `Image file exceeds maximum limit of ${process.env.MAX_IMAGE_SIZE_MB || "10"}MB.`,
        });
        continue;
      }
 
      try {
        const arrayBuffer = await file.arrayBuffer();
        itemsToProcess.push({
          filename: file.name,
          originalPath: file.name,
          buffer: Buffer.from(arrayBuffer),
          size: file.size,
        });
      } catch (err: any) {
        skippedRecords.push({
          filename: file.name,
          reason: `Failed to read file buffer: ${err.message}`,
        });
      }
    }
  }
 
  // Sequential uploading to Cloudinary and database registration
  for (const item of itemsToProcess) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_PROCESSING_TIME) {
      isTimedOut = true;
      break;
    }
 
    try {
      // Calculate MD5 hash of image buffer
      const hash = crypto.createHash("md5").update(item.buffer).digest("hex");
 
      // Check if duplicate hash exists
      const existing = await ImageModel.findOne({ hash });
      if (existing) {
        skippedRecords.push({
          filename: item.filename,
          reason: "Duplicate asset (file already exists in the catalog).",
        });
        continue;
      }
 
      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(
        item.buffer,
        cloudinaryFolder,
        item.filename
      );
 
      // Save to MongoDB
      const imageDoc = await ImageModel.create({
        filename: item.filename,
        originalPath: item.originalPath,
        hash,
        cloudinaryPublicId: cloudinaryResult.public_id,
        cloudinaryUrl: cloudinaryResult.secure_url,
        fileSize: item.size,
        uploadDate: todayStr,
        uploadedBy: userEmail,
        status: "pending",
      });

      uploadedRecords.push({
        id: imageDoc._id,
        filename: imageDoc.filename,
        cloudinaryUrl: imageDoc.cloudinaryUrl,
        uploadDate: imageDoc.uploadDate,
      });
    } catch (uploadErr: any) {
      console.error(`Error uploading "${item.filename}":`, uploadErr);
      skippedRecords.push({
        filename: item.filename,
        reason: `Failed to upload to Cloudinary/Save to DB: ${uploadErr.message}`,
      });
    }
  }

  // If we timed out and still have items left, list them as skipped due to timeout
  const processedLength = uploadedRecords.length + (itemsToProcess.length - itemsToProcess.slice(uploadedRecords.length).length);
  if (isTimedOut && processedLength < itemsToProcess.length) {
    const remaining = itemsToProcess.slice(uploadedRecords.length);
    for (const rem of remaining) {
      skippedRecords.push({
        filename: rem.filename,
        reason: "Skipped: Ingestion run-time limit exceeded (Processing timeout).",
      });
    }
  }

  const status = isTimedOut 
    ? "partial_success" 
    : (skippedRecords.length > 0 && uploadedRecords.length > 0) 
      ? "partial_success" 
      : (uploadedRecords.length === 0 && itemsToProcess.length > 0)
        ? "error"
        : "success";

  const message = isTimedOut
    ? "Ingestion paused. The processing run-time limit was reached."
    : status === "success"
      ? "All files uploaded and cataloged successfully."
      : status === "partial_success"
        ? "Upload finished with some files skipped or partial imports."
        : "No files were successfully uploaded.";

  if (uploadedRecords.length > 0) {
    triggerQueueProcessing();
  }

  return NextResponse.json(
    {
      success: status !== "error",
      status,
      message,
      processedCount: uploadedRecords.length,
      totalCount: itemsToProcess.length,
      uploaded: uploadedRecords,
      skipped: skippedRecords,
    },
    { status: status === "error" ? 400 : 200 }
  );
}
