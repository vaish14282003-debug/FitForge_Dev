const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const STATUSES = ['BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];

// A one-to-one personal training session between a trainer and a member.
const bookingSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    trainer: { type: ObjectId, ref: 'User', required: true },
    member: { type: ObjectId, ref: 'User', required: true, index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'BOOKED' },
    notes: { type: String, default: '', maxlength: 300 },
    bookedBy: { type: ObjectId, ref: 'User', required: true },
    cancelledBy: { type: ObjectId, ref: 'User', default: null },
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

// The database itself refuses a second live booking of the same trainer slot, even under a race.
bookingSchema.index({ trainer: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { status: 'BOOKED' } });
bookingSchema.index({ gym: 1, startsAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.STATUSES = STATUSES;
