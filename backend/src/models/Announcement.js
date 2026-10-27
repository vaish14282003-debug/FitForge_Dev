const mongoose = require('mongoose');

const AUDIENCES = ['EVERYONE', 'MEMBERS', 'TRAINERS', 'STAFF'];

const announcementSchema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    body: { type: String, required: true, maxlength: 1000 },
    audience: { type: String, enum: AUDIENCES, default: 'EVERYONE' },
    pinned: { type: Boolean, default: false },
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

module.exports = mongoose.model('Announcement', announcementSchema);
module.exports.AUDIENCES = AUDIENCES;
