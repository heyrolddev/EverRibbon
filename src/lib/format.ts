import { brand } from "../../config/index.ts";

/**
 * Money and dates, in the shop's own terms.
 *
 * One module, because the alternative is what the previous system grew: six
 * separate `const peso = (n) => "₱" + n.toFixed(2)` declarations in six
 * components, each rounding slightly differently, and a currency change that
 * means editing sixty-six places.
 */

const { locale, timeZone, currency } = brand;

const decimal = new Intl.NumberFormat(locale, {
  minimumFractionDigits: currency.decimals,
  maximumFractionDigits: currency.decimals,
});
const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

/**
 * `₱1,234.50`, or `-₱1.25` — the sign goes outside the symbol.
 *
 * `₱-1.25` reads as a currency code followed by a negative number and is the
 * kind of thing a person notices once and distrusts the whole screen for.
 */
export function money(n: number): string {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + currency.symbol + decimal.format(Math.abs(v));
}

/** Same, without the centavos — for charts and tiles where they are noise. */
export function moneyRound(n: number): string {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + currency.symbol + whole.format(Math.abs(Math.round(v)));
}

/** A count of something, grouped: `1,240`. */
export function quantity(n: number, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n) || 0);
}

/*
 * Formatters are built once at module scope rather than per call. Two reasons:
 * `Intl.DateTimeFormat` is expensive to construct, and pinning both locale and
 * zone makes the server's render and the browser's hydration identical by
 * construction — a client component formatting with the host's timezone and
 * then the phone's is React error #418, seen as text that flickers and a page
 * that throws.
 */
const dt = new Intl.DateTimeFormat(locale, {
  timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
const d = new Intl.DateTimeFormat(locale, {
  timeZone, month: "short", day: "numeric", year: "numeric",
});
const dtFull = new Intl.DateTimeFormat(locale, {
  timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

export const formatDateTime = (v: string | Date) => dt.format(new Date(v));
export const formatDate = (v: string | Date) => d.format(new Date(v));
export const formatDateTimeFull = (v: string | Date) => dtFull.format(new Date(v));

/*
 * The shop's calendar date, in the shop's zone.
 *
 * `new Date().toISOString().slice(0,10)` is the obvious version and it is
 * wrong for every shop east of Greenwich: it returns the UTC date, so for the
 * first eight hours of a Manila day it names yesterday. A screen filtering
 * "today" against a date column then reads empty all morning.
 *
 * `en-CA` is the shortest route to ISO ordering out of Intl, which is the one
 * formatter that actually knows about zones.
 */
const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
});
export const shopToday = (at: Date = new Date()): string => isoDate.format(at);

/** Minutes as a person says them: `45 min`, `2 hr`, `2 hr 15 min`. */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}
