const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A file a trainer shares with clients: a diet sheet, a stretching guide, a programme PDF.
const resourceSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    owner: { type: ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    // Everyone who is (or later becomes) the owner's client, or a fixed list of members.
    shareWithAllClients: { type: Boolean, default: true },
    sharedWith: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.downloadUrl = `/api/resources/${ret.id}/file`;
        delete ret._id;
        delete ret.__v;
        delete ret.fileKey;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Resource', resourceSchema);
