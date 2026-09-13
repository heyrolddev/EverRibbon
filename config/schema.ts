/**
 * What a shop is, to this system.
 *
 * Everything a business changes about itself lives in one of these objects and
 * nowhere else. The rule the whole template rests on: `src/` may read this, and
 * may never contain a brand name, a currency symbol, a timezone, or a colour.
 *
 * That rule is not a convention to remember — `tests/no-brand-literals.test.ts`
 * fails the build when it is broken. The system it replaces had 115 brand
 * strings across 54 files and six separate copies of the same money formatter,
 * all of which began as one reasonable exception.
 */

/** Colour roles, as raw values. Named by job, never by hue. */
export type Palette = {
  /** The brand ramp. 400 is the fill; 500 rules a border; 600 carries text. */
  "brand-200": string; "brand-300": string; "brand-400": string;
  "brand-500": string; "brand-600": string; "brand-700": string;
  /** Ink: text and dark grounds. Warm or cool, never pure black. */
  "ink-900": string; "ink-800": string; "ink-700": string;
  "ink-500": string; "ink-400": string;
  /** Paper: light grounds. */
  "paper-50": string; "paper-100": string; "paper-200": string;
  /**
   * Two supporting hues, and the semantic three. Each has a `-lift` variant
   * for dark mode: a colour legible on paper is rarely legible on ink, and
   * inverting the palette rather than re-picking these is how dark mode ends
   * up with unreadable warnings.
   */
  "alt-a": string; "alt-a-lift": string;
  "alt-b": string; "alt-b-lift": string;
  /** Whichever of ink or paper is legible ON brand-400. Not every brand gets ink. */
  "on-accent": string;
  "ok": string; "ok-lift": string;
  "warn": string; "warn-lift": string;
  "bad": string; "bad-lift": string;
};

export const PALETTE_KEYS = [
  "brand-200","brand-300","brand-400","brand-500","brand-600","brand-700",
  "ink-900","ink-800","ink-700","ink-500","ink-400",
  "paper-50","paper-100","paper-200",
  "alt-a","alt-a-lift","alt-b","alt-b-lift","on-accent",
  "ok","ok-lift","warn","warn-lift","bad","bad-lift",
] as const satisfies readonly (keyof Palette)[];

export type BrandConfig = {
  /** Stable id. Used by NEXT_PUBLIC_BRAND and as the asset folder name. */
  key: string;
  name: string;
  tagline: string;
  description: string;

  /** BCP-47. Drives number, date and currency formatting everywhere. */
  locale: string;
  /** IANA zone. The shop's own clock — never the server's, never the phone's. */
  timeZone: string;
  currency: {
    /** ISO 4217, for anything machine-readable. */
    code: string;
    /** What a person sees. */
    symbol: string;
    decimals: number;
  };

  /**
   * Whether an order is handed over now or made first.
   *
   * `immediate` is a counter: order, pay, collect. `made_to_order` unlocks the
   * deposit, the proof gate and the capacity calendar, because a shop that
   * builds before it hands over needs all three and a shop that does not is
   * only confused by them.
   */
  fulfillment: "immediate" | "made_to_order";

  /** Only read when fulfillment is `made_to_order`. */
  deposit: {
    percent: number;
    /**
     * Minutes between a deal being agreed and work starting, during which a
     * cancellation is still free.
     *
     * This exists because "non-refundable once production starts" is only fair
     * if the customer had a moment to change their mind — and because the shop
     * needs the same moment to notice a mistake before cutting stock.
     */
    coolingOffMinutes: number;
  };

  palette: Palette;
  fonts: {
    /** The shop's voice. Headings only. */
    display: string;
    /** The interface. Deliberately the same across shops. */
    body: string;
    /** Money, quantities, measurements. Needs tabular figures. */
    mono: string;
  };
};

/** Thrown at import time, not at render time, so a bad config never ships. */
export class BrandConfigError extends Error {}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateBrand(b: BrandConfig): BrandConfig {
  const fail = (m: string) => { throw new BrandConfigError(`brand "${b?.key ?? "?"}": ${m}`); };

  for (const k of ["key","name","tagline","description","locale","timeZone"] as const)
    if (!b?.[k]?.trim()) fail(`${k} is required`);

  if (!/^[a-z][a-z0-9-]*$/.test(b.key)) fail("key must be lowercase kebab-case");
  if (!b.currency?.symbol) fail("currency.symbol is required");
  if (!/^[A-Z]{3}$/.test(b.currency?.code ?? "")) fail("currency.code must be a 3-letter ISO code");
  if (!Number.isInteger(b.currency.decimals) || b.currency.decimals < 0 || b.currency.decimals > 4)
    fail("currency.decimals must be 0-4");

  // A bad IANA zone silently formats in UTC, which looks like working software
  // until an order placed at 9pm files itself under the wrong trading day.
  try { new Intl.DateTimeFormat(b.locale, { timeZone: b.timeZone }).format(new Date()); }
  catch { fail(`locale "${b.locale}" or timeZone "${b.timeZone}" is not one the runtime knows`); }

  if (b.fulfillment !== "immediate" && b.fulfillment !== "made_to_order")
    fail("fulfillment must be 'immediate' or 'made_to_order'");

  if (b.fulfillment === "made_to_order") {
    const d = b.deposit;
    if (!d || typeof d.percent !== "number" || d.percent < 0 || d.percent > 100)
      fail("deposit.percent must be 0-100 for a made_to_order shop");
    if (!Number.isFinite(d.coolingOffMinutes) || d.coolingOffMinutes < 0)
      fail("deposit.coolingOffMinutes must be zero or more");
  }

  for (const k of PALETTE_KEYS) {
    const v = b.palette?.[k];
    if (!v) fail(`palette.${k} is missing`);
    if (!HEX.test(v)) fail(`palette.${k} must be a 6-digit hex, got "${v}"`);
  }

  for (const k of ["display","body","mono"] as const)
    if (!b.fonts?.[k]?.trim()) fail(`fonts.${k} is required`);

  return b;
}
