// Calendar dates as "YYYY-MM-DD" strings, so membership periods never drift across timezones.

/** The local calendar date of `date` for a browser timezone offset (Date#getTimezoneOffset). */
const dayKey = (date, tz = 0) => new Date(date.getTime() - tz * 60 * 1000).toISOString().slice(0, 10);

const parse = (day) => new Date(`${day}T00:00:00Z`);
const format = (date) => date.toISOString().slice(0, 10);

function addDays(day, days) {
  const date = parse(day);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** Adds months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
function addMonths(day, months) {
  const date = parse(day);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return format(target);
}

/** Last day of a membership that starts on `start` and runs for `months`. */
const periodEnd = (start, months) => addDays(addMonths(start, months), -1);

const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / (24 * 60 * 60 * 1000));

module.exports = { dayKey, addDays, addMonths, periodEnd, daysBetween };
