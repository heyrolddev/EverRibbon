import { brand } from "../../config/index.ts";

/**
 * The shop's artwork, wherever it currently lives.
 *
 * Pure, so the shapes and the fallback rule are testable and so a client
 * component can hold the result without dragging a database client with it.
 * The reading is in `brand-assets-server.ts`.
 */

export type Wordmark = {
  src: string;
  /** The artwork's own pixels, so the space is reserved before it loads. */
  width: number;
  height: number;
};

export type BrandAssets = {
  /** For light grounds — the header, a printed page. */
  light: Wordmark | null;
  /**
   * For dark grounds, or null to use the light one everywhere.
   *
   * A gold mark on black is the point of a gold brand, and the same file on a
   * cream header measures 2.28 against the paper — below the 4.5 a person
   * needs to read it. One file cannot serve both grounds honestly.
   */
  dark: Wordmark | null;
};

/** What a shop has before anyone has uploaded anything. */
export const CONFIG_ASSETS: BrandAssets = {
  light: brand.wordmark,
  dark: null,
};

const mark = (
  src: unknown,
  width: unknown,
  height: unknown
): Wordmark | null => {
  const url = typeof src === "string" ? src.trim() : "";
  const w = Number(width);
  const h = Number(height);
  // All three or nothing. A URL with no dimensions renders at whatever the
  // browser guesses and shifts the header as it loads.
  if (!url || !(w > 0) || !(h > 0)) return null;
  return { src: url, width: Math.round(w), height: Math.round(h) };
};

/**
 * A settings row, as artwork.
 *
 * The config is the floor, not the default: an uploaded mark wins, and a shop
 * that has uploaded nothing keeps whatever shipped with its config. Clearing
 * the upload therefore returns it to the config rather than to nothing, which
 * is what "remove" should mean for a value that has a shipped default.
 */
export function assetsFrom(row: Record<string, unknown> | null): BrandAssets {
  if (!row) return CONFIG_ASSETS;
  return {
    light:
      mark(row.wordmark_url, row.wordmark_width, row.wordmark_height) ??
      CONFIG_ASSETS.light,
    dark: mark(
      row.wordmark_dark_url,
      row.wordmark_dark_width,
      row.wordmark_dark_height
    ),
  };
}

/** The mark to draw on a given ground, falling back rather than drawing none. */
export const markFor = (
  assets: BrandAssets,
  ground: "light" | "dark"
): Wordmark | null =>
  ground === "dark" ? (assets.dark ?? assets.light) : assets.light;
