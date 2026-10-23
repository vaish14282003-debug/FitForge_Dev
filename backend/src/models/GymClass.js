const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A group class members can join, up to capacity.
const gymClassSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 300 },
    trainer: { type: ObjectId, ref: 'User', default: null },
    location: { type: String, default: '', maxlength: 60 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 200 },
    attendees: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.spotsLeft = Math.max(0, ret.capacity - (ret.attendees?.length ?? 0));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

gymClassSchema.index({ gym: 1, startsAt: 1 });

module.exports = mongoose.model('GymClass', gymClassSchema);
