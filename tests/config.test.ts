import test from "node:test";
import assert from "node:assert/strict";
import { BRANDS, resolveBrand, brandVars, validateBrand, PALETTE_KEYS, BrandConfigError } from "../config/index.ts";

/* resolveBrand throws on an unknown key, so it narrows where BRANDS[x] cannot. */
const ever = resolveBrand("everribbon");
const other = resolveBrand("pepperpan");

test("every registered brand validates", () => {
  for (const [key, b] of Object.entries(BRANDS)) {
    assert.doesNotThrow(() => validateBrand(b), `brand ${key}`);
    assert.equal(b.key, key, "registry key must match the config's own key");
  }
});

test("an unknown brand fails loudly, naming the ones that exist", () => {
  assert.throws(() => resolveBrand("not-a-shop"), /not a shop this build knows.*everribbon/s);
});

test("validation rejects the mistakes a new shop actually makes", () => {
  const ok = ever;
  const broken = (patch: Record<string, unknown>) =>
    () => validateBrand({ ...ok, ...patch } as typeof ok);

  assert.throws(broken({ timeZone: "Mars/Olympus" }), BrandConfigError);
  assert.throws(broken({ currency: { code: "peso", symbol: "₱", decimals: 2 } }), BrandConfigError);
  assert.throws(broken({ currency: { code: "PHP", symbol: "", decimals: 2 } }), BrandConfigError);
  assert.throws(broken({ key: "Ever Ribbon" }), BrandConfigError);
  assert.throws(broken({ fulfillment: "sometimes" }), BrandConfigError);
  assert.throws(broken({ palette: { ...ok.palette, "brand-400": "C9A227" } }), BrandConfigError);
  assert.throws(broken({ roles: { accentFill: "brand-9000", onAccent: "ink-950" } }), BrandConfigError);
  assert.throws(broken({ deposit: { percent: 250, coolingOffMinutes: 20 } }), BrandConfigError);
});

test("brandVars emits every palette key as a custom property", () => {
  const css = brandVars(ever);
  assert.match(css, /^:root\{/);
  for (const k of PALETTE_KEYS) assert.ok(css.includes(`--${k}:`), `missing --${k}`);
  // Plus the two the stylesheet cannot resolve on its own.
  assert.ok(css.includes("--accent-fill:"));
  assert.ok(css.includes("--on-accent:"));
  assert.ok(css.includes("--font-display:"));
});

test("two brands produce different CSS from the same code path", () => {
  // The whole thesis, as one assertion.
  assert.notEqual(brandVars(ever), brandVars(other));
});
