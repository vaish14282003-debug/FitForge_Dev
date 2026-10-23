const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');

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
    avatarUrl: { type: String, default: null },
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
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
