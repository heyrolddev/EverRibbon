import type { BrandConfig } from "../schema.ts";

/**
 * The reference shop.
 *
 * Every test runs against this rather than against whichever real business
 * happens to be first, so a test can never start depending on one shop's
 * colours or currency. It is also the answer to "what does a config look
 * like?" for the next business that buys the system — and, deliberately, it is
 * an `immediate` shop with no deposit, so the made-to-order paths are exercised
 * against a config that does not have them.
 */
export const example: BrandConfig = {
  key: "example",
  name: "Example Shop",
  tagline: "A shop that does not exist",
  description: "The reference configuration the test suite runs against.",

  locale: "en-GB",
  timeZone: "Europe/London",
  currency: { code: "GBP", symbol: "£", decimals: 2 },

  fulfillment: "immediate",
  deposit: { percent: 0, coolingOffMinutes: 0 },

  palette: {
    "brand-200": "#D6E0E6", "brand-300": "#9DB4C0", "brand-400": "#6E94A8",
    "brand-500": "#3E5C6C", "brand-600": "#2F4756", "brand-700": "#22343F",
    "ink-900": "#0F1417", "ink-800": "#192126", "ink-700": "#26323A",
    "ink-500": "#46565F", "ink-400": "#6A7C86",
    "paper-50": "#F7F9FA", "paper-100": "#EDF1F3", "paper-200": "#DCE3E7",
    "on-accent": "#0F1417",
    "alt-a": "#7A3E8C", "alt-a-lift": "#B47FC4",
    "alt-b": "#1F6F6B", "alt-b-lift": "#4FA9A4",
    "ok": "#2F6B45", "ok-lift": "#6FBE94",
    "warn": "#8A5212", "warn-lift": "#E0A063",
    "bad": "#93232A", "bad-lift": "#E0797F",
  },

  fonts: {
    display: 'Georgia, "Times New Roman", serif',
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
};
