const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
// Browser timezone offset (Date#getTimezoneOffset), so "today" follows the gym-goer's clock.
const tz = Joi.number().integer().min(-840).max(840).default(0);

const qrCheckIn = Joi.object({ token: Joi.string().max(1000).required(), tz });
const staffCheckIn = Joi.object({ memberId: objectId.required(), tz });
const summaryQuery = Joi.object({ member: objectId, tz });
const statsQuery = Joi.object({ tz, days: Joi.number().integer().min(7).max(60).default(14) });

module.exports = { qrCheckIn, staffCheckIn, summaryQuery, statsQuery };
