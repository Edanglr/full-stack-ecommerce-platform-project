import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
    },
  },
  { timestamps: true }
);

function toSlug(name = "") {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

categorySchema.pre("validate", function (next) {
  if (!this.slug) this.slug = toSlug(this.name);
  next();
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
