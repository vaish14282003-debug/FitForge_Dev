const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const TYPES = [
  'PLAN_ASSIGNED',
  'WORKOUT_REVIEWED',
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'CLASS_CANCELLED',
  'MEMBERSHIP_ADDED',
  'MEMBERSHIP_EXPIRING',
  'ANNOUNCEMENT',
  'MESSAGE',
  'RESOURCE_SHARED',
];

// One alert for one person. `link` is an in-app path to open when it's clicked.
const notificationSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 1000 },
    link: { type: String, default: null },
    actor: { type: ObjectId, ref: 'User', default: null },
    // Stops the same automatic alert being created twice (e.g. "expiring" for one membership).
    dedupeKey: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.dedupeKey;
        return ret;
      },
    },
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
