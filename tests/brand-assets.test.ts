import test from "node:test";
import assert from "node:assert/strict";
import {
  assetsFrom,
  markFor,
  needsMeasuring,
  CONFIG_ASSETS,
} from "../src/lib/brand-assets.ts";

/**
 * A logo is the one asset whose absence every page is designed to survive, so
 * the rules about where it comes from are worth stating precisely.
 */

const row = {
  wordmark_url: "https://example.test/light.png",
  wordmark_width: 1200,
  wordmark_height: 400,
  wordmark_dark_url: null,
  wordmark_dark_width: null,
  wordmark_dark_height: null,
};

test("an uploaded mark wins over the one that shipped", () => {
  const a = assetsFrom(row);
  assert.equal(a.light?.src, "https://example.test/light.png");
  assert.deepEqual([a.light?.width, a.light?.height], [1200, 400]);
});

test("no row at all falls back to the config rather than to nothing", () => {
  assert.deepEqual(assetsFrom(null), CONFIG_ASSETS);
});

test("clearing the upload returns to the config, not to blank", () => {
  // "Remove" on a value with a shipped default means "go back to the default".
  const cleared = assetsFrom({ ...row, wordmark_url: null, wordmark_width: null, wordmark_height: null });
  assert.deepEqual(cleared.light, CONFIG_ASSETS.light);
});

test("a URL with no dimensions is a wordmark waiting to be measured", () => {
  /*
   * This asserted the opposite until the first owner was asked for the pixel
   * size of their logo and answered "just copy the other shop's numbers" —
   * which would have declared a 2.92:1 box around a square mark. The number
   * IS the aspect ratio, so a wrong one is worse than none.
   *
   * The file knows. The server reads it from the header on the next render
   * and stores it, and until then the mark draws from its own ratio and the
   * header settles once.
   */
  const pasted = assetsFrom({ ...row, wordmark_width: null, wordmark_height: null });
  assert.equal(pasted.light?.src, "https://example.test/light.png");
  assert.equal(pasted.light?.width, null);
  assert.ok(needsMeasuring(pasted.light));
});

test("half a size is no size — one dimension describes no rectangle", () => {
  const half = assetsFrom({ ...row, wordmark_height: null });
  assert.equal(half.light?.src, "https://example.test/light.png");
  assert.equal(half.light?.width, null, "the lone width is discarded, not kept");
  assert.equal(half.light?.height, null);
  assert.ok(needsMeasuring(half.light));
});

test("a measured mark needs no measuring", () => {
  assert.equal(needsMeasuring(assetsFrom(row).light), false);
  assert.equal(needsMeasuring(null), false, "nothing to measure is not pending");
});

test("whitespace is not a URL", () => {
  assert.deepEqual(assetsFrom({ ...row, wordmark_url: "   " }).light, CONFIG_ASSETS.light);
});

test("a dark ground uses the light mark until a dark one is uploaded", () => {
  const a = assetsFrom(row);
  assert.equal(markFor(a, "dark")?.src, "https://example.test/light.png");

  const both = assetsFrom({
    ...row,
    wordmark_dark_url: "https://example.test/gold.png",
    wordmark_dark_width: 900,
    wordmark_dark_height: 300,
  });
  assert.equal(markFor(both, "dark")?.src, "https://example.test/gold.png");
  // And the light ground is untouched by it.
  assert.equal(markFor(both, "light")?.src, "https://example.test/light.png");
});

test("a shop with no artwork anywhere asks for none, and gets a name instead", () => {
  const none = assetsFrom({});
  // CONFIG_ASSETS.light is null for a shop whose config ships no wordmark;
  // markFor then returns null and the Logo sets the name in the display face.
  assert.equal(markFor(none, "light"), CONFIG_ASSETS.light);
  assert.equal(markFor(none, "dark"), CONFIG_ASSETS.light);
});
