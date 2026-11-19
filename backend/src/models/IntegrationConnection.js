const mongoose = require('mongoose');

// A member's link to one fitness service (see src/integrations). Tokens are sealed (utils/secretBox).
const integrationConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    // The member's id and name on that service, for the profile card.
    externalId: { type: String, default: '' },
    displayName: { type: String, default: '' },
    scope: { type: String, default: '' },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    // Send every finished workout automatically.
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

integrationConnectionSchema.index({ user: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationConnection', integrationConnectionSchema);
