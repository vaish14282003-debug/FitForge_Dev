const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');
const { fileUrl } = require('../storage');

const FITNESS_GOALS = ['LOSE_WEIGHT', 'BUILD_MUSCLE', 'GET_STRONGER', 'IMPROVE_FITNESS', 'STAY_HEALTHY'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.MEMBER, index: true },
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      index: true,
      required() {
        return this.role !== ROLES.SUPER_ADMIN;
      },
    },
    // Only meaningful for members: the trainer they are assigned to.
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Storage key of the profile photo; exposed to clients as avatarUrl.
    avatarKey: { type: String, default: null },
    phone: { type: String, default: '', maxlength: 20 },
    bio: { type: String, default: '', maxlength: 300 },
    heightCm: { type: Number, default: null, min: 100, max: 250 },
    dateOfBirth: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    fitnessGoal: { type: String, enum: [...FITNESS_GOALS, null], default: null },
    // Member goals, used for goal progress on the Progress page.
    goals: {
      targetWeight: { type: Number, default: null, min: 20, max: 400 },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        ret.avatarUrl = fileUrl(ret.avatarKey);
        delete ret.avatarKey;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
module.exports.FITNESS_GOALS = FITNESS_GOALS;
