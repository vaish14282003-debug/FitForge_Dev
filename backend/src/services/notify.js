const Notification = require('../models/Notification');
const logger = require('../config/logger');

/**
 * Creates the same alert for each recipient. Never throws: an alert failing must not undo the
 * action that caused it (a booking is still booked even if its notification can't be written).
 */
async function notify(recipients, { gym, type, title, body = '', link = null, actor = null, dedupeKey = null }) {
  const ids = [...new Set(recipients.filter(Boolean).map(String))].filter((id) => !actor || id !== String(actor));
  if (ids.length === 0) return;
  try {
    await Notification.insertMany(
      ids.map((user) => ({ gym, user, type, title, body, link, actor, dedupeKey })),
      { ordered: false }
    );
  } catch (err) {
    // Duplicate dedupe keys are expected and fine; anything else is worth a log line.
    if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) logger.warn(`notify failed: ${err.message}`);
  }
}

module.exports = { notify };
