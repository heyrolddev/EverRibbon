import test from "node:test";
import assert from "node:assert/strict";
import { BRANDS, validateBrand } from "../config/index.ts";
import { contrast, deltaE } from "./contrast.ts";

/**
 * A brand that fails contrast fails the build.
 *
 * This is the test that makes the system safe to sell. Handing a customisable
 * palette to a shop owner without it means the first buyer who loves pale gold
 * ships a site whose prices cannot be read in daylight, and neither of you
 * finds out until a customer gives up on the order form.
 *
 * Text pairs must clear 4.5:1; borders and large figures 3:1. Both are the
 * WCAG AA thresholds, and both are floors rather than targets.
 */

/** [foreground, background, minimum, what it is] */
const RULES: [string, string, number, string][] = [
  ["ink-900", "paper-50", 7, "body text on the light ground"],
  ["ink-500", "paper-50", 4.5, "muted text on the light ground"],
  ["brand-600", "paper-50", 4.5, "the accent when it carries text"],
  ["brand-500", "paper-50", 3, "the accent when it rules a border"],
  ["on-accent", "brand-400", 4.5, "a label sitting on a filled accent block"],

  ["paper-100", "ink-900", 7, "body text on the dark ground"],
  ["paper-200", "ink-900", 4.5, "muted text on the dark ground"],
  ["brand-400", "ink-900", 4.5, "the accent as text in dark mode"],

  ["ok", "paper-50", 4.5, "success, light"],
  ["warn", "paper-50", 4.5, "warning, light"],
  ["bad", "paper-50", 4.5, "danger, light"],
  ["alt-a", "paper-50", 4.5, "first supporting hue, light"],
  ["alt-b", "paper-50", 4.5, "second supporting hue, light"],

  ["ok-lift", "ink-900", 4.5, "success, dark"],
  ["warn-lift", "ink-900", 4.5, "warning, dark"],
  ["bad-lift", "ink-900", 4.5, "danger, dark"],
  ["alt-a-lift", "ink-900", 4.5, "first supporting hue, dark"],
  ["alt-b-lift", "ink-900", 4.5, "second supporting hue, dark"],
];

/** Calibrated: real palettes clear 41, the amber-on-gold mistake scores 30.7. */
const MIN_DELTA_E = 38;

for (const [key, b] of Object.entries(BRANDS)) {
  test(`${key}: every palette pair is legible`, () => {
    for (const [fg, bg, min, what] of RULES) {
      const r = contrast(b.palette[fg as keyof typeof b.palette]!, b.palette[bg as keyof typeof b.palette]!);
      assert.ok(
        r >= min,
        `${key}: ${what} — ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`
      );
    }
  });

  test(`${key}: the semantic three are told apart from the brand`, () => {
    // A gold shop whose "warning" is amber has a warning nobody reads as one.
    // Contrast ratio cannot see this — gold against amber scores 1.23:1, which
    // says "identical lightness", not "different colour". ΔE can: the palettes
    // here land at 41-72, while amber-on-gold lands at 30.7 and yellow at 20.6.
    for (const state of ["warn", "bad", "ok"] as const) {
      const d = deltaE(b.palette[state], b.palette["brand-400"]);
      assert.ok(
        d >= MIN_DELTA_E,
        `${key}: ${state} is ΔE ${d.toFixed(1)} from the brand fill — too close to read as a state`
      );
    }
  });

  test(`${key}: config validates`, () => {
    assert.doesNotThrow(() => validateBrand(b));
  });
}

test("a brand with an unreadable accent is rejected by the rules above", () => {
  // Pale gold on ivory: the exact mistake this suite exists to catch.
  assert.ok(contrast("#E0C877", "#FBF8F1") < 4.5);
  assert.ok(contrast("#8C6E16", "#FBF8F1") >= 4.5);
});

test("the amber-warning-on-a-gold-brand mistake is actually caught", () => {
  assert.ok(deltaE("#D97706", "#C9A227") < MIN_DELTA_E, "amber warn should be rejected");
  assert.ok(deltaE("#E6C200", "#C9A227") < MIN_DELTA_E, "yellow warn should be rejected");
  assert.ok(deltaE("#9C4A1E", "#C9A227") >= MIN_DELTA_E, "terracotta warn should be accepted");
});
