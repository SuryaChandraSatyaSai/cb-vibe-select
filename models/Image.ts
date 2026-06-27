import mongoose, { Schema, Document, Model } from "mongoose";

export interface IImage extends Document {
  filename: string;
  originalPath?: string;
  hash?: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  fileSize: number;
  uploadDate: string; // YYYY-MM-DD
  uploadedBy: string; // Uploader email
  createdAt: Date;
  qualityScore?: number;
  attributes?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    colorfulness?: number;
    temperature?: "warm" | "cool" | "neutral";
    palette?: string[];
    sharpness?: number;
  };
  tags?: string[];
  status?: "pending" | "processing" | "completed" | "failed";
  analysisError?: string;
  objects?: Array<{
    label: string;
    score: number;
    box: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  }>;
}

const ImageSchema: Schema = new Schema(
  {
    filename: { type: String, required: true },
    originalPath: { type: String },
    hash: { type: String, index: true },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadDate: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    qualityScore: { type: Number },
    attributes: {
      brightness: { type: Number },
      contrast: { type: Number },
      saturation: { type: Number },
      colorfulness: { type: Number },
      temperature: { type: String, enum: ["warm", "cool", "neutral"] },
      palette: { type: [String] },
      sharpness: { type: Number },
    },
    tags: { type: [String] },
    objects: {
      type: [{
        label: { type: String, required: true },
        score: { type: Number, required: true },
        box: {
          xmin: { type: Number, required: true },
          ymin: { type: Number, required: true },
          xmax: { type: Number, required: true },
          ymax: { type: Number, required: true }
        }
      }],
      default: undefined
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "completed",
      index: true,
    },
    analysisError: { type: String },
  },
  {
    timestamps: true,
  }
);

// Define text search index over key catalog metadata fields
ImageSchema.index(
  {
    filename: "text",
    originalPath: "text",
    tags: "text",
    "objects.label": "text",
  },
  {
    weights: {
      filename: 10,
      originalPath: 5,
      tags: 3,
      "objects.label": 2,
    },
    name: "ImageTextIndex",
  }
);

const ImageModel: Model<IImage> =
  mongoose.models.Image || mongoose.model<IImage>("Image", ImageSchema);

export default ImageModel;
