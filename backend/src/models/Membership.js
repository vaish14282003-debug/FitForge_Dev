const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const day = { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ };

const PAYMENT_STATUSES = ['PAID', 'PENDING'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK', 'OTHER'];

// One paid-for period. Status (upcoming/active/expired) is worked out from the dates when read.
const membershipSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'User', required: true, index: true },
    plan: { type: ObjectId, ref: 'MembershipPlan', required: true },
    // Snapshot of the plan at sale time; later price changes don't rewrite history.
    planName: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
    startDate: day,
    endDate: day,
    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, required: true },
      method: { type: String, enum: PAYMENT_METHODS, default: null },
      reference: { type: String, default: '', maxlength: 100 },
      paidAt: { type: Date, default: null },
    },
    notes: { type: String, default: '', maxlength: 300 },
    renewalOf: { type: ObjectId, ref: 'Membership', default: null },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
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

membershipSchema.index({ gym: 1, endDate: 1 });
membershipSchema.index({ gym: 1, 'payment.paidAt': 1 });

module.exports = mongoose.model('Membership', membershipSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
