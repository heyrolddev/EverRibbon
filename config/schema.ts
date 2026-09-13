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

/**
 * The seven ramps every shop has, and the eleven steps each one carries.
 *
 * Naming is by job, never by hue: a shop whose brand is gold and a shop whose
 * brand is red both write `brand-600`, so a component can be written once. The
 * five identity ramps map exactly onto the five areas of the back office —
 * the day's work, the workshop, the numbers, settings, and the data — which is
 * why there are five and not an arbitrary number.
 *
 * Eleven steps is more than any one screen uses. They are config values and
 * cost nothing, and the alternative is a shop needing a code change to get a
 * hover state.
 */
export const RAMPS = ["brand", "accent", "ink", "paper", "ok", "warn", "bad"] as const;
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type Ramp = (typeof RAMPS)[number];
export type Step = (typeof STEPS)[number];
export type PaletteKey = `${Ramp}-${Step}`;
export type Palette = Record<PaletteKey, string>;

export const PALETTE_KEYS: PaletteKey[] = RAMPS.flatMap((r) =>
  STEPS.map((s) => `${r}-${s}` as PaletteKey)
);

/**
 * The two facts about an accent that no shared stylesheet can decide.
 *
 * A pale brand wants dark text on it; a deep brand wants light. Gold at its
 * most characteristic is a 400 and takes near-black; a deep red is a 700 and
 * takes paper. Guessing either in CSS produces a button nobody can read, so
 * the brand states both and `tests/palette.test.ts` checks the pair clears
 * 4.5:1.
 */
export type Roles = {
  /** The step used for a filled brand block — a primary button, a chip. */
  accentFill: PaletteKey;
  /** What is legible on top of it. */
  onAccent: PaletteKey;
};

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
  roles: Roles;
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

  for (const k of ["accentFill", "onAccent"] as const) {
    const v = b.roles?.[k];
    if (!v) fail(`roles.${k} is required`);
    if (!PALETTE_KEYS.includes(v)) fail(`roles.${k} is "${v}", which is not a palette key`);
  }

  for (const k of ["display","body","mono"] as const)
    if (!b.fonts?.[k]?.trim()) fail(`fonts.${k} is required`);

  return b;
}
