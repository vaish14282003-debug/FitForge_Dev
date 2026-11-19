const mongoose = require('mongoose');

// One per FitForge user who linked their Strava account. Tokens are sealed (utils/secretBox).
const stravaConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    athleteId: { type: String, required: true },
    athleteName: { type: String, default: '' },
    scope: { type: String, default: '' },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    // Send every finished workout to Strava automatically.
    autoUpload: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.accessToken;
        delete ret.refreshToken;
        delete ret.user;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('StravaConnection', stravaConnectionSchema);
