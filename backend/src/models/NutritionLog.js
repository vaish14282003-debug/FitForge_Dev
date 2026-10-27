const mongoose = require('mongoose');

const MEALS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

const entrySchema = new mongoose.Schema(
  {
    meal: { type: String, enum: MEALS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    calories: { type: Number, required: true, min: 0, max: 5000 },
    protein: { type: Number, default: 0, min: 0, max: 500 },
    carbs: { type: Number, default: 0, min: 0, max: 1000 },
    fat: { type: Number, default: 0, min: 0, max: 500 },
  },
  { timestamps: true }
);

// One document per member per local day: what they ate and how much water they drank.
const nutritionLogSchema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    entries: { type: [entrySchema], default: [] },
    waterMl: { type: Number, default: 0, min: 0, max: 10000 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.entries = (ret.entries ?? []).map(({ _id, ...e }) => ({ id: _id.toString(), ...e }));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

nutritionLogSchema.index({ member: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
module.exports.MEALS = MEALS;
