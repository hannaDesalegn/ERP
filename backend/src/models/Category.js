import mongoose from 'mongoose';

// Product categories.
//
// docs/entities.md defines Product.categoryId and the denormalised
// Product.categoryName but never defines Category itself, even though
// GET /api/products/categories is in the contract. This is the minimum the
// endpoint and the product form need. If the shape grows, entities.md gets the
// field first.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true },
);

categorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    return ret;
  },
});

export default mongoose.model('Category', categorySchema);
