import type { BrandConfig } from "../schema.ts";

/**
 * EverRibbon — ribbon printing and ribbon flower bouquets, Calumpit, Bulacan.
 *
 * The palette is not invented. Every colour below is a ribbon or foil the shop
 * already buys, so the brand and the purchase order cannot drift apart:
 *
 *   brand   Shecan Special Foils, Bright Gold 100mm
 *   ink     Black Shecan Ribbons 80mm — warm, never #000
 *   paper   Cream Shecan Ribbons 38mm — ivory, never white
 *   ok      Moss Green Shecan Ribbons 25mm
 *
 * Each ramp is grown from that one colour by `scripts/palette.mjs`, so all
 * seven share a lightness curve and a `600` weighs the same whichever it is.
 *
 * Two constraints are load-bearing, and `tests/palette.test.ts` enforces both.
 * Metallic gold measures 2.28 against ivory, so it can never carry text — that
 * is why text takes brand-700 while the fill stays at 400. And because the
 * brand IS gold, the warning colour cannot be amber or it reads as brand
 * rather than as alarm; terracotta takes that job, and plum is the accent
 * precisely because it sits far from both the gold and the two reds.
 */
export const everribbon: BrandConfig = {
  key: "everribbon",
  name: "EverRibbon",
  tagline: "Where every ribbon tells a story",
  description:
    "Custom ribbon printing, graduation sashes and handcrafted ribbon flower bouquets — made to order in Calumpit, Bulacan.",

  locale: "en-PH",
  timeZone: "Asia/Manila",
  currency: { code: "PHP", symbol: "₱", ascii: "P", decimals: 2 },

  fulfillment: "made_to_order",

  contact: {
    street: "Purok 2, F. Carlos Street, Balungao",
    locality: "Calumpit",
    region: "Bulacan",
    country: "PH",
    phone: "+63 955 941 8558",
    phoneHref: "+639559418558",
    priceRange: "\u20b1\u20b1",
    // No pin yet. The ones that were here belonged to the shop this config
    // was scaffolded from and pointed at a different province — which is the
    // failure mode this field is nullable for.
    lat: null,
    lng: null,
    mapUrl: null,
  },

  socials: [
    { name: "Facebook", href: "https://www.facebook.com/EverRibbon", handle: "EverRibbon" },
  ],

  /**
   * A ribbon shop sells to people planning one day months out, so the strip
   * says what can be ordered and how long it takes — not what is fresh today.
   */
  copy: {
    catalogue: "Shop",
    loading: "Tying the ribbon…",
    badge: "MADE TO ORDER",
    strip: [
      "Custom ribbon prints",
      "Graduation sashes & sablay",
      "EverCraft flower bouquets",
      "Weddings & pageants",
      "Card printing & invitations",
    ],
    catalogueBlurb:
      "printed ribbon, graduation sashes and handcrafted ribbon flower bouquets",
    businessNoun: "a ribbon printer and bouquet maker",
    termsClause: {
      title: "Handmade, and the colours",
      body:
        "Every flower is folded by hand, so no two bouquets are identical and " +
        "small differences in shape and fullness are part of what you are " +
        "buying. Ribbon colour can also shift slightly between deliveries of " +
        "stock, and a screen shows colour differently again. If an exact " +
        "shade matters — matching a gown or a school colour — say so before " +
        "you order and we will check the roll against it first.",
    },
    keywords: [
      "customized ribbon printing Bulacan",
      "personalized ribbon print Philippines",
      "graduation sash Bulacan",
      "sablay printing Philippines",
      "ribbon flower bouquet Bulacan",
      "graduation bouquet Calumpit",
      "wedding ribbon Philippines",
      "handmade ribbon flowers",
      "bouquet na hindi nalalanta",
      "personalized giveaways Bulacan",
    ],
  },

  schema: {
    // Not a Restaurant, and not the generic Store either: a maker that sells
    // what it makes is a HomeGoodsStore to schema.org, which is the type the
    // gift and decor results are drawn from.
    type: "HomeGoodsStore",
    catalogue: "OfferCatalog",
    extras: {},
  },

  // No wordmark file in the repo yet. The mark exists — a gold ribbon drawn as
  // an infinity loop over a script wordmark — but it is drawn for a dark
  // ground, and this site's header is cream in the light theme, where metallic
  // gold measures 2.28 against the paper. So it needs either a transparent
  // export sitting on a dark plate or a second light-ground version; until one
  // of those lands the name is set in Bodoni, which is legible on both.
  //
  // To switch: drop the file at public/brand/everribbon/logo.png and replace
  // this with { src: "/brand/everribbon/logo.png", width: W, height: H } using
  // the artwork's real pixel size.
  wordmark: null,

  palette: {
    "brand-50": "#FCF5E4", "brand-100": "#F7EAC9", "brand-200": "#EDD79E", "brand-300": "#DFBF6A", "brand-400": "#C9A227", "brand-500": "#B48E00",
    "brand-600": "#947400", "brand-700": "#765C00", "brand-800": "#584400", "brand-900": "#3B2C00", "brand-950": "#241A00",   // anchor #C9A227 at 400
    "accent-50": "#FFF1FA", "accent-100": "#FFE0F5", "accent-200": "#FBC6EB", "accent-300": "#F1A7DC", "accent-400": "#E288CA", "accent-500": "#CC6CB3",
    "accent-600": "#AD5396", "accent-700": "#8C3E79", "accent-800": "#6B2D5C", "accent-900": "#481B3D", "accent-950": "#2C0F25",   // anchor #6B2D5C at 800
    "ink-50": "#F7F6F3", "ink-100": "#EDEBE5", "ink-200": "#DCD8CF", "ink-300": "#C7C2B5", "ink-400": "#B1AB9B", "ink-500": "#9A9382",
    "ink-600": "#7F7868", "ink-700": "#655F51", "ink-800": "#4B463B", "ink-900": "#312E26", "ink-950": "#12100B",   // anchor #12100B at 950
    "paper-50": "#FBF8F1", "paper-100": "#F0EADD", "paper-200": "#E2D8C2", "paper-300": "#CFC1A2", "paper-400": "#BBAA83", "paper-500": "#A39268",
    "paper-600": "#887750", "paper-700": "#6C5E3C", "paper-800": "#51452A", "paper-900": "#362E1A", "paper-950": "#201B0E",   // anchor #FBF8F1 at 50
    "ok-50": "#F0F8F1", "ok-100": "#E0F0E2", "ok-200": "#C5E1CB", "ok-300": "#A6CEAF", "ok-400": "#88BA93", "ok-500": "#6DA279",
    "ok-600": "#548760", "ok-700": "#3F6B4A", "ok-800": "#2D5036", "ok-900": "#1C3522", "ok-950": "#0F2013",   // anchor #3F6B4A at 700
    "warn-50": "#FFF3EE", "warn-100": "#FFE5D9", "warn-200": "#FFCCB5", "warn-300": "#FBAD89", "warn-400": "#EE9062", "warn-500": "#D87442",
    "warn-600": "#B85A28", "warn-700": "#9C4A1E", "warn-800": "#72310B", "warn-900": "#4D1F05", "warn-950": "#301103",   // anchor #9C4A1E at 700
    "bad-50": "#FFF2F1", "bad-100": "#FFE3E1", "bad-200": "#FFCAC6", "bad-300": "#FFA8A3", "bad-400": "#FF7F7D", "bad-500": "#EA6061",
    "bad-600": "#C84549", "bad-700": "#96242B", "bad-800": "#7C2125", "bad-900": "#551316", "bad-950": "#350A0B",   // anchor #96242B at 700
  },

  /* Gold is at its most itself as a 400, which takes near-black on top. */
  roles: { accentFill: "brand-400", onAccent: "ink-950" },

  fonts: {
    // The face itself is loaded by next/font in layout.tsx; this names it and
    // says what to fall back to while it arrives.
    display: 'var(--font-display-face), Didot, Georgia, serif',
    body: 'var(--font-body-face), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-mono-face), ui-monospace, SFMono-Regular, Menlo, monospace',
  },
};
