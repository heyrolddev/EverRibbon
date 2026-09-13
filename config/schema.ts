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
    /**
     * The same symbol in plain ASCII.
     *
     * A thermal receipt printer speaks a code page from the 1990s and renders
     * anything outside it as a black block or, worse, as one byte of a
     * multi-byte character that shifts every column after it. So receipts fold
     * to ASCII before they are sent, and this is what the symbol folds to.
     */
    ascii: string;
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

  /**
   * Where the shop physically is, and where it posts.
   *
   * This is what a search engine and a chat app ask for before they will show
   * a pasted link as anything but bare text — and for a shop that markets on
   * Messenger and TikTok, that is the difference between a naked URL and a
   * card with a photo and a reason to tap.
   *
   * `lat`/`lng` are a fact about the business, deliberately kept apart from
   * whatever origin delivery fees are measured from: one only changes if the
   * shop physically moves, the other is a pricing knob someone adjusts on a
   * Tuesday. Reading the first out of the second means anyone nudging delivery
   * silently moves where the business claims to be.
   */
  contact: {
    street: string;
    locality: string;
    region: string;
    /** ISO 3166-1 alpha-2. */
    country: string;
    phone: string;
    /** The same number, dial-able: no spaces, no punctuation. */
    phoneHref: string;
    /** As a search engine grades it — "$$", "₱₱". */
    priceRange: string;
    lat: number;
    lng: number;
    /** The map listing addressed by its own id, not by a copied viewport URL. */
    mapUrl: string;
  };

  /** Rendered in this order, so put the one the shop actually uses first. */
  socials: { name: string; href: string; handle: string }[];

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
  if (!b.currency?.ascii?.trim()) fail("currency.ascii is required — receipts cannot print the symbol");
  if (/[^\x20-\x7E]/.test(b.currency.ascii)) fail("currency.ascii must be plain ASCII");
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

  const c = b.contact;
  for (const k of ["street","locality","region","country","phone","phoneHref"] as const)
    if (!c?.[k]?.trim()) fail(`contact.${k} is required`);
  if (!/^\+?[0-9]+$/.test(c.phoneHref)) fail("contact.phoneHref must be dial-able: digits and an optional +");
  if (!/^[A-Z]{2}$/.test(c.country)) fail("contact.country must be a 2-letter ISO code");
  if (!Number.isFinite(c.lat) || Math.abs(c.lat) > 90) fail("contact.lat must be a latitude");
  if (!Number.isFinite(c.lng) || Math.abs(c.lng) > 180) fail("contact.lng must be a longitude");

  if (!Array.isArray(b.socials)) fail("socials must be an array (empty is fine)");
  for (const s of b.socials) {
    if (!s?.name?.trim() || !s?.handle?.trim()) fail("every social needs a name and a handle");
    // A URL copied out of an app carries that share's tracking, which would
    // then sit in the shop's markup telling every visitor it once scanned its
    // own QR code. Strip it back to the plain profile address.
    if (!/^https:\/\//.test(s.href ?? "")) fail(`social "${s.name}" needs an https URL`);
    if (/[?&](utm_|igsi|sender_device|_rdc|mibextid)/.test(s.href)) fail(`social "${s.name}" still carries share tracking`);
  }

  return b;
}
