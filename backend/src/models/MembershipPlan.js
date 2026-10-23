const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    durationMonths: { type: Number, required: true, min: 1, max: 24 },
    // Whole rupees.
    price: { type: Number, required: true, min: 0, max: 1000000 },
    description: { type: String, default: '', maxlength: 300 },
    // Archived plans stay on existing memberships but can't be sold.
    isActive: { type: Boolean, default: true },
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

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
