const mongoose = require('mongoose');

const time = { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ };

// A trainer's repeating weekly hours, in the gym's local time. Bookable slots are cut from these.
const availabilitySchema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // day: 0 = Sunday … 6 = Saturday.
    weekly: { type: [{ _id: false, day: { type: Number, min: 0, max: 6, required: true }, start: time, end: time }], default: [] },
    sessionMinutes: { type: Number, enum: [30, 45, 60, 90], default: 60 },
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

module.exports = mongoose.model('Availability', availabilitySchema);
