import type { PaymentMethod, Standing } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,500 / ₹13,500 / ₹1,00,000, Indian digit grouping. */
export const formatINR = (amount: number) => inr.format(amount);

export const formatDay = (day: string, withYear = false) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(withYear && { year: "numeric" }) });

export const durationLabel = (months: number) =>
  months === 1 ? "1 month" : months === 12 ? "1 year" : months % 12 === 0 ? `${months / 12} years` : `${months} months`;

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

export const STANDING_LABEL: Record<Standing, string> = {
  ACTIVE: "Active",
  EXPIRING: "Expiring",
  UPCOMING: "Starts soon",
  EXPIRED: "Expired",
  NONE: "No membership",
};

/** Mirrors the API's periodEnd so the sell dialog can preview dates before saving. */
export function previewEnd(start: string, months: number) {
  const [y, m, d] = start.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

export function addDay(day: string, days = 1) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
