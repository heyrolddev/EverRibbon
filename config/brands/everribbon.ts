import type { BrandConfig } from "../schema.ts";

/**
 * EverRibbon — ribbon printing and ribbon flower bouquets, Pampanga.
 *
 * The palette is not invented. Every colour below is a ribbon or foil the shop
 * already buys, so the brand and the purchase order cannot drift apart:
 *
 *   brand-400  Shecan Special Foils, Bright Gold 100mm   the metallic
 *   brand-600  4 cm GOLDEN                              gold that reads as text
 *   ink-900    Black Shecan Ribbons 80mm                warm, never #000
 *   paper-50   Cream Shecan Ribbons 38mm                ivory, never white
 *   alt-a      2.5 cm BURGANDY
 *   alt-b      Moss Green Shecan Ribbons 25mm
 *
 * Two constraints are load-bearing and `tests/palette.test.ts` enforces both:
 * metallic gold measures 2.28 against ivory, so it can never carry text — hence
 * the separate 500 and 600 steps. And because the brand IS gold, the warning
 * colour cannot be amber or it reads as brand; alarm is terracotta here.
 */
export const everribbon: BrandConfig = {
  key: "everribbon",
  name: "EverRibbon",
  tagline: "Ribbon flowers that keep",
  description:
    "Hand-made ribbon flower bouquets and foil-printed ribbon for graduations, weddings and birthdays. Made to order in Pampanga.",

  locale: "en-PH",
  timeZone: "Asia/Manila",
  currency: { code: "PHP", symbol: "₱", decimals: 2 },

  fulfillment: "made_to_order",
  deposit: {
    percent: 25,
    // The shop starts cutting within twenty minutes of a deal, so the deposit
    // is non-refundable from that point rather than from a countdown to the
    // due date. This is the window in which either side can still walk away.
    coolingOffMinutes: 20,
  },

  palette: {
    "brand-200": "#EFE0B4", "brand-300": "#E0C877", "brand-400": "#C9A227",
    "brand-500": "#AD8A1E", "brand-600": "#8C6E16", "brand-700": "#6E5610",
    "ink-900": "#12100B", "ink-800": "#1C1913", "ink-700": "#2A251C",
    "ink-500": "#4A4234", "ink-400": "#6B6154",
    "paper-50": "#FBF8F1", "paper-100": "#F4EFE3", "paper-200": "#E7E0CE",
    "on-accent": "#12100B",
    "alt-a": "#7B2B3B", "alt-a-lift": "#C2606F",
    "alt-b": "#5A6B4A", "alt-b-lift": "#7E9169",
    "ok": "#3F6B4A", "ok-lift": "#6FAE81",
    "warn": "#9C4A1E", "warn-lift": "#D1783F",
    "bad": "#96242B", "bad-lift": "#DC6068",
  },

  fonts: {
    // A didone — the letterform of engraved invitations, and the printed cousin
    // of foil on ribbon. Optical sizing keeps its hairlines alive when small.
    display: '"Bodoni Moda", Didot, Georgia, serif',
    body: '"Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
};
