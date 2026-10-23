const crypto = require('crypto');
const mongoose = require('mongoose');

// No 0/O/1/I so codes survive being read out loud at the front desk.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateJoinCode = () =>
  Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

const gymSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinCode: { type: String, unique: true, uppercase: true, default: generateJoinCode },
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

module.exports = mongoose.model('Gym', gymSchema);
