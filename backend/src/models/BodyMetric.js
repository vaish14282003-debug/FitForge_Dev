const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// One entry per member per calendar day; logging again that day updates it.
const bodyMetricSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'User', required: true },
    // The member's local date as YYYY-MM-DD, so entries never shift across timezones.
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    weight: { type: Number, default: null, min: 20, max: 400 },
    bodyFat: { type: Number, default: null, min: 2, max: 70 },
    measurements: {
      chest: { type: Number, default: null },
      waist: { type: Number, default: null },
      hips: { type: Number, default: null },
      arm: { type: Number, default: null },
      thigh: { type: Number, default: null },
    },
    note: { type: String, default: '', maxlength: 200 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

bodyMetricSchema.index({ member: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('BodyMetric', bodyMetricSchema);
