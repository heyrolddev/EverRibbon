import type { BrandConfig } from "../schema.ts";

/**
 * The shop this system was extracted from — a Taiwanese-style food stall.
 *
 * It is here as proof rather than as decoration. Phase 1 is only finished when
 * the same code runs two businesses that share nothing: different name,
 * different colours, different fonts, different fulfillment model. A stall
 * hands food over immediately and takes no deposit, so configuring it also
 * exercises every path that a made-to-order shop takes and it does not.
 *
 * Note where the anchors land. `#B91313` is called a 600 in the original
 * stylesheet, but measured against a shared lightness curve it is a 700 — so
 * the port maps old class names onto new steps by measurement rather than by
 * matching the number, which is the only way the two shops can share one set
 * of components and both still look like themselves.
 */
export const pepperpan: BrandConfig = {
  key: "pepperpan",
  name: "Pepper Pan",
  tagline: "Home of Taiwan-Style Black Pepper Noodles",
  description:
    "Taiwan-style black pepper noodles, rice meals and milktea, made fresh daily. Order ahead for pickup or delivery.",

  locale: "en-PH",
  timeZone: "Asia/Manila",
  currency: { code: "PHP", symbol: "\u20b1", ascii: "P", decimals: 2 },

  // A stall hands the food over now. No deposit, no proof, no capacity calendar.
  fulfillment: "immediate",

  contact: {
    street: "In front of Palengkeni (New Apalit Public Market), beside Osave!",
    locality: "Apalit",
    region: "Pampanga",
    country: "PH",
    phone: "+63 947 353 3060",
    phoneHref: "+639473533060",
    priceRange: "\u20b1\u20b1",
    // The pin the owner dropped on their own business listing, to the metre.
    lat: 14.9531856,
    lng: 120.7576564,
    // Addressed by the listing's own id. The URL copied out of the map app is
    // a place name, a viewport, a zoom level and four tracking parameters
    // wrapped around this one number, and all of that goes stale.
    mapUrl: "https://maps.google.com/?cid=13918401762537882815",
  },

  socials: [
    { name: "Facebook", href: "https://www.facebook.com/profile.php?id=61591109867523", handle: "Pepper Pan" },
    { name: "Instagram", href: "https://www.instagram.com/pepperpan.taiwanstylefood", handle: "@pepperpan.taiwanstylefood" },
    { name: "TikTok", href: "https://www.tiktok.com/@pepper.pan.taiwan", handle: "@pepper.pan.taiwan" },
  ],

  /** The five lines that used to be hardcoded in three separate components. */
  copy: {
    catalogue: "Menu",
    loading: "Firing up the pan\u2026",
    badge: "MADE FRESH DAILY",
    strip: [
      "Black Pepper Noodles",
      "Made Fresh Daily",
      "Free Coffee Dine-In",
      "Giant Ji Pai",
      "Taiwan Milktea",
    ],
    catalogueBlurb:
      "Taiwan-style black pepper noodles, Ji Pai chicken, rice products and milktea",
    businessNoun: "a food stall",
    termsClause: {
      title: "Allergies",
      body:
        "We cook everything in one small kitchen. Peanuts, soy, wheat, eggs, " +
        "shellfish and sesame are all in regular use, and we cannot promise " +
        "any product is free of traces of them. If you have a serious " +
        "allergy, please ring us before ordering rather than relying on the " +
        "notes box.",
    },
    keywords: [
      "Taiwanese food Apalit",
      "Taiwan street food Pampanga",
      "black pepper noodles",
      "black pepper noodles Apalit",
      "peppery noodles Pampanga",
      "Ji Pai",
      "Ji Pai chicken Apalit",
      "milktea Apalit",
      "food delivery Apalit Pampanga",
      "pagkain sa Apalit",
      "masarap na pagkain Apalit",
      "New Apalit Public Market food",
    ],
  },

  schema: {
    type: "Restaurant",
    catalogue: "Menu",
    // The one property a Restaurant has that no other type does, and the one
    // a "taiwanese food near me" result is matched on.
    extras: {
      servesCuisine: ["Taiwanese", "Asian", "Noodles"],
      acceptsReservations: false,
    },
  },

  // Source art is 7329 x 2511 once trimmed.
  wordmark: { src: "/brand/pepperpan/logo.png", width: 7329, height: 2511 },

  palette: {
    "brand-50": "#FFF3F1", "brand-100": "#FFE4DF", "brand-200": "#FFCAC2", "brand-300": "#FFA89C", "brand-400": "#FF8072", "brand-500": "#FF463B",
    "brand-600": "#DC221F", "brand-700": "#B91313", "brand-800": "#890004", "brand-900": "#5F0001", "brand-950": "#3B0101",   // anchor #B91313 at 700
    "accent-50": "#FFF6D9", "accent-100": "#FFEAAA", "accent-200": "#FFCF00", "accent-300": "#EABD00", "accent-400": "#CEA700", "accent-500": "#B28F00",
    "accent-600": "#927500", "accent-700": "#745D00", "accent-800": "#574400", "accent-900": "#3A2D00", "accent-950": "#231A00",   // anchor #FFCF00 at 200
    "ink-50": "#FBF4F2", "ink-100": "#F4E8E4", "ink-200": "#E9D3CD", "ink-300": "#D9BBB3", "ink-400": "#C6A298", "ink-500": "#AF897F",
    "ink-600": "#936F66", "ink-700": "#76574F", "ink-800": "#584039", "ink-900": "#3B2A25", "ink-950": "#1C110E",   // anchor #1C110E at 950
    "paper-50": "#FFFAF2", "paper-100": "#F3EADB", "paper-200": "#E6D7BD", "paper-300": "#D6BF9B", "paper-400": "#C2A77A", "paper-500": "#AC8F5E",
    "paper-600": "#8F7446", "paper-700": "#735B33", "paper-800": "#564323", "paper-900": "#3A2C15", "paper-950": "#231A0B",   // anchor #FFFAF2 at 50
    "ok-50": "#EBFAF2", "ok-100": "#D7F3E3", "ok-200": "#B5E6CB", "ok-300": "#8ED5B0", "ok-400": "#66C194", "ok-500": "#42AA7B",
    "ok-600": "#0C8156", "ok-700": "#0E714B", "ok-800": "#025537", "ok-900": "#013923", "ok-950": "#012214",   // anchor #0C8156 at 600
    "warn-50": "#FFF3ED", "warn-100": "#FFE5D9", "warn-200": "#FFCCB4", "warn-300": "#FFAB84", "warn-400": "#FB874D", "warn-500": "#D95F0E",
    "warn-600": "#C25200", "warn-700": "#9B4000", "warn-800": "#752E00", "warn-900": "#501C00", "warn-950": "#330E00",   // anchor #D95F0E at 500
    "bad-50": "#FFF2F3", "bad-100": "#FFE3E5", "bad-200": "#FFC9CE", "bad-300": "#FFA6B1", "bad-400": "#FF7B91", "bad-500": "#F44F73",
    "bad-600": "#D2325A", "bad-700": "#A3123F", "bad-800": "#820F32", "bad-900": "#59071F", "bad-950": "#380411",   // anchor #A3123F at 700
  },

  /* A deep red needs paper on top of it, where gold needs ink. */
  roles: { accentFill: "brand-700", onAccent: "paper-50" },

  fonts: {
    // The face itself is loaded by next/font in layout.tsx; this names it and
    // says what to fall back to while it arrives.
    display: 'var(--font-display-face), Georgia, serif',
    body: 'var(--font-body-face), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-mono-face), ui-monospace, SFMono-Regular, Menlo, monospace',
  },
};
