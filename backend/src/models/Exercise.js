const mongoose = require('mongoose');
const { MUSCLE_GROUPS, EQUIPMENT } = require('../config/exercise');
const { fileUrl } = require('../storage');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    muscleGroup: { type: String, enum: MUSCLE_GROUPS, required: true, index: true },
    equipment: { type: String, enum: EQUIPMENT, required: true },
    instructions: { type: String, default: '', maxlength: 1000 },
    // Storage key of an uploaded photo; exposed to clients as imageUrl.
    imageKey: { type: String, default: null },
    // null = the built-in library every gym shares; otherwise a gym's own exercise.
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.isCustom = ret.gym != null;
        ret.imageUrl = fileUrl(ret.imageKey);
        delete ret.imageKey;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

exerciseSchema.index({ gym: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
