import mongoose, { Schema, Document, Model } from "mongoose";

// A seeded known person. The 128-float `descriptor` is the face-api embedding of
// the avatar; uploads are matched against every person's descriptor at ingest.
export interface IPerson extends Document {
  name: string;
  title?: string;
  bio?: string;
  links?: Array<{ label?: string; url: string }>;
  avatarPublicId: string;
  avatarUrl: string;
  descriptors: number[][]; // one or more 128-d face embeddings; more angles -> better recall
  createdAt: Date;
}

const PersonSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    title: { type: String },
    bio: { type: String },
    links: { type: [{ label: String, url: { type: String, required: true } }], default: undefined },
    avatarPublicId: { type: String, required: true },
    avatarUrl: { type: String, required: true },
    descriptors: { type: [[Number]], required: true }, // array of 128-length embeddings
  },
  { timestamps: true }
);

const PersonModel: Model<IPerson> =
  mongoose.models.Person || mongoose.model<IPerson>("Person", PersonSchema);

export default PersonModel;
