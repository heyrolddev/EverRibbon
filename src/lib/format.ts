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

/*
 * One formatter per precision, built once.
 *
 * Intl.NumberFormat is expensive to construct and these are called in a loop
 * down a list of orders, so they are cached rather than made per call.
 */
const formatters = new Map<number, Intl.NumberFormat>();
function at(decimals: number): Intl.NumberFormat {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(decimals, f);
  }
  return f;
}

/**
 * `₱1,234.50`, or `-₱1.25` — the sign goes outside the symbol.
 *
 * `₱-1.25` reads as a currency code followed by a negative number and is the
 * kind of thing a person notices once and distrusts the whole screen for.
 */
export function money(n: number, decimals: number = currency.decimals): string {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + currency.symbol + at(decimals).format(Math.abs(v));
}

/** Same, without the centavos — for charts and tiles where they are noise. */
export function moneyRound(n: number): string {
  return money(Math.round(Number(n) || 0), 0);
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

/**
 * The shop zone's UTC offset at a given instant, as `+08:00`.
 *
 * Read per instant rather than stored as a constant, because half the world's
 * zones change theirs twice a year. Manila does not, which is exactly why the
 * original was a hardcoded `+08:00` — and exactly why copying that into a
 * template would break the first shop that keeps summer time.
 */
function zoneOffsetAt(at: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  return /GMT([+-]\d{2}:\d{2})/.exec(name)?.[1] ?? "+00:00";
}

/**
 * Midday on a given calendar day, in the shop's own zone, as an ISO instant.
 *
 * Midday and not midnight: midnight in a zone ahead of UTC belongs to the
 * previous UTC day, so a date typed by the owner would file itself one day
 * early on every screen that groups by the stored instant. Midday is the one
 * time of day no offset on earth can move across a date boundary.
 *
 * Returns null for a day that does not exist — `new Date` accepts 2026-02-31
 * and silently rolls it into March, so a review typed with a slip would be
 * filed three days after the date it claims.
 */
export function shopMidday(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  // The shape is right but the date may still be nonsense — "2026-13-01"
  // matches the pattern and produces an Invalid Date, which `formatToParts`
  // throws on rather than returning anything. Check before asking the offset.
  const probe = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(probe.getTime())) return null;

  const at = new Date(`${day}T12:00:00${zoneOffsetAt(probe)}`);
  if (Number.isNaN(at.getTime())) return null;
  return shopToday(at) === day ? at.toISOString() : null;
}
