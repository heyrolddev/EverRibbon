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
   *
   * Only the mode lives here. What the deposit IS, how long it stays
   * refundable and how many minutes a day holds are all things an owner
   * changes without a deploy, so they live in the database -- see
   * src/lib/operating.ts.
   */
  fulfillment: "immediate" | "made_to_order";


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
    /**
     * The pin, or null until somebody has actually dropped one.
     *
     * Nullable because a wrong pin is worse than no pin: it sends people to
     * a building that is not the shop, and it is exactly the field that gets
     * copied from whatever the config was forked from. Absent, the structured
     * data omits the geo block; a search engine then places the business from
     * its postal address, which is at least the address the shop typed.
     */
    lat: number | null;
    lng: number | null;
    /** The map listing addressed by its own id, not by a copied viewport URL. */
    mapUrl: string | null;
  };

  /** Rendered in this order, so put the one the shop actually uses first. */
  socials: { name: string; href: string; handle: string }[];

  /**
   * The shop's own words.
   *
   * A template can share every screen and still not share a sentence. These
   * are the ones that were found hardcoded in the system this grew from —
   * a marquee of five claims, a line under the loading mark, a pill on the
   * share card, the word a shop uses for its own catalogue. None of them is
   * a design decision; each is a fact about one business, and each was
   * invisible until the second shop rendered the first shop's copy.
   */
  copy: {
    /** What this shop calls its catalogue. A kitchen has a Menu; a maker has a Shop. */
    catalogue: string;
    /** The line under the mark while the first page paints. */
    loading: string;
    /** One short claim, set in a pill on the link-preview card. */
    badge: string;
    /**
     * Short lines for the scrolling strip, used when no promo is live.
     *
     * An empty strip reads as a page that failed to load, which is worse
     * than a shop with nothing on offer — so this is what it falls back to.
     */
    strip: string[];
    /**
     * What the catalogue holds, as one phrase, for a search snippet.
     *
     * Nobody searches for "menu" or "shop". They search for the thing, and
     * often in their own language — so this is where a shop names its
     * products the way a customer would type them.
     */
    catalogueBlurb: string;
    /**
     * What this business is, in a sentence about itself — "a food stall",
     * "a ribbon maker". Read straight into the terms page.
     */
    businessNoun: string;
    /**
     * The one clause this trade needs and no other does, or `null`.
     *
     * A kitchen owes its customers an allergen warning. A maker owes them a
     * note on colour and handmade variation. Neither is boilerplate and
     * neither belongs in the other's terms — but every trade has exactly one
     * of these, so it gets a slot rather than a fork of the page.
     */
    termsClause: { title: string; body: string } | null;
    /**
     * Terms for the directory and aggregator sites that still scrape the
     * keywords tag. Search engines dropped it over a decade ago; these are
     * the searches a person would actually make, local and specific. One
     * broad word wins nothing, so a shop lists none.
     */
    keywords: string[];
  };

  /**
   * How a search engine should classify this business.
   *
   * Getting this wrong is not cosmetic. A ribbon maker published as a
   * `Restaurant` that `servesCuisine: ["Taiwanese"]` does not rank badly for
   * ribbon searches — it competes in the wrong category entirely, and the
   * local results it does appear in are ones nobody wanted it in.
   */
  schema: {
    /** The schema.org type: "Restaurant", "Store", "HomeGoodsStore", … */
    type: string;
    /**
     * What this type calls its list of things for sale.
     *
     * Only a food business takes a `Menu` of `MenuItem`s. Everything else
     * takes an `OfferCatalog` of `Product`s, and a block using the wrong one
     * is discarded whole rather than read loosely.
     */
    catalogue: "Menu" | "OfferCatalog";
    /**
     * Properties that belong to that type and to no other — `servesCuisine`
     * for a restaurant, `brand` for a store. Merged in as written, because
     * schema.org has hundreds of types and a template cannot list them.
     */
    extras: Record<string, unknown>;
  };

  /**
   * The shop's wordmark, or `null` while it has none.
   *
   * A wordmark is artwork a business owns, and a new shop rarely has one on
   * the first day. `null` is not a missing file: it is the supported state
   * where the name is set in the display face instead. A broken image icon
   * is what happens when a template assumes otherwise.
   */
  wordmark: { src: string; width: number; height: number } | null;

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
  // Both or neither: half a coordinate places a shop on the equator or on
  // the prime meridian, which is a real place and not this one.
  if ((c.lat === null) !== (c.lng === null))
    fail("contact.lat and contact.lng must both be set, or both be null");
  if (c.lat !== null && (!Number.isFinite(c.lat) || Math.abs(c.lat) > 90))
    fail("contact.lat must be a latitude");
  if (c.lng !== null && (!Number.isFinite(c.lng) || Math.abs(c.lng) > 180))
    fail("contact.lng must be a longitude");

  for (const k of ["catalogue", "loading", "badge", "catalogueBlurb", "businessNoun"] as const)
    if (!b.copy?.[k]?.trim()) fail(`copy.${k} is required`);
  if (!Array.isArray(b.copy.strip) || b.copy.strip.length === 0)
    fail("copy.strip needs at least one line — an empty strip reads as a broken page");
  for (const line of b.copy.strip)
    if (!line?.trim()) fail("every copy.strip line must say something");
  if (!Array.isArray(b.copy.keywords)) fail("copy.keywords must be an array (empty is fine)");
  if (b.copy.termsClause !== null &&
      (!b.copy.termsClause?.title?.trim() || !b.copy.termsClause?.body?.trim()))
    fail("copy.termsClause needs both a title and a body (or set it to null)");

  if (!b.schema?.type?.trim()) fail("schema.type is required — the schema.org type this business is");
  if (b.schema.catalogue !== "Menu" && b.schema.catalogue !== "OfferCatalog")
    fail("schema.catalogue must be 'Menu' (food) or 'OfferCatalog' (everything else)");
  if (b.schema.extras === null || typeof b.schema.extras !== "object" || Array.isArray(b.schema.extras))
    fail("schema.extras must be an object (empty is fine)");

  // `null` is a supported state; an object that is half-filled is not, and it
  // is the shape that renders a broken image rather than failing here.
  if (b.wordmark !== null) {
    if (!b.wordmark?.src?.trim()) fail("wordmark.src is required (or set wordmark to null)");
    if (!(b.wordmark.width > 0) || !(b.wordmark.height > 0))
      fail("wordmark needs the artwork's real width and height, to reserve its space before it loads");
  }

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
