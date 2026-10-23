const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// One visit per member per local calendar day; checking in again that day is a no-op.
const attendanceSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    checkedInAt: { type: Date, required: true },
    method: { type: String, enum: ['QR', 'STAFF'], required: true },
    recordedBy: { type: ObjectId, ref: 'User', default: null },
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

attendanceSchema.index({ member: 1, day: 1 }, { unique: true });
attendanceSchema.index({ gym: 1, day: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
