import test from "node:test";
import assert from "node:assert/strict";
import { BRANDS, validateBrand, RAMPS, STEPS } from "../config/index.ts";
import { contrast, deltaE } from "./contrast.ts";
import { hexToOklch, isMonotonic } from "../scripts/palette.mjs";

/**
 * A brand that fails these fails the build.
 *
 * This is the test that makes a customisable palette safe to hand to someone
 * else. Without it, the first buyer who loves pale gold ships a site whose
 * prices cannot be read in daylight, and neither of you finds out until a
 * customer gives up on the order form.
 *
 * Text pairs must clear 4.5:1 and borders 3:1 — the WCAG AA thresholds, as
 * floors rather than targets — in both themes.
 */

/** [foreground, background, minimum, what it is] — mirrors src/app/globals.css. */
const PAIRS: [string, string, number, string][] = [
  ["ink-950", "paper-100", 7, "body text, light"],
  ["ink-800", "paper-100", 4.5, "muted text, light"],
  ["ink-700", "paper-100", 4.5, "faint text, light"],
  ["brand-700", "paper-100", 4.5, "the accent when it carries text, light"],
  ["brand-600", "paper-100", 3, "the accent when it rules a border, light"],
  ["ok-700", "paper-100", 4.5, "success, light"],
  ["warn-700", "paper-100", 4.5, "warning, light"],
  ["bad-700", "paper-100", 4.5, "danger, light"],

  ["paper-100", "ink-950", 7, "body text, dark"],
  ["paper-300", "ink-950", 4.5, "muted text, dark"],
  ["ink-300", "ink-950", 4.5, "faint text, dark"],
  ["brand-400", "ink-950", 4.5, "the accent as text, dark"],
  ["brand-500", "ink-950", 3, "the accent as a border, dark"],
  ["ok-400", "ink-950", 4.5, "success, dark"],
  ["warn-400", "ink-950", 4.5, "warning, dark"],
  ["bad-400", "ink-950", 4.5, "danger, dark"],
];

/** Calibrated: real palettes clear 41, the amber-on-gold mistake scores 30.7. */
const MIN_DELTA_E = 20;

for (const [key, b] of Object.entries(BRANDS)) {
  test(`${key}: every role pairing is legible in both themes`, () => {
    for (const [fg, bg, min, what] of PAIRS) {
      const r = contrast(b.palette[fg as keyof typeof b.palette]!, b.palette[bg as keyof typeof b.palette]!);
      assert.ok(r >= min, `${key}: ${what} — ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
  });

  test(`${key}: a filled brand block can be read`, () => {
    // The one pairing no shared stylesheet can decide, so the brand states it.
    const fill = b.palette[b.roles.accentFill];
    const text = b.palette[b.roles.onAccent];
    const r = contrast(text, fill);
    assert.ok(r >= 4.5, `${key}: ${b.roles.onAccent} on ${b.roles.accentFill} is ${r.toFixed(2)}:1`);
  });

  test(`${key}: the identity ramps are tellable apart`, () => {
    // A gold shop whose warning is amber has a warning nobody reads as one.
    // Contrast ratio is blind to this — gold against amber scores 1.23:1,
    // which says "same lightness", not "different colour". ΔE can see it.
    const identity = ["brand", "accent", "ok", "warn", "bad"] as const;
    for (let i = 0; i < identity.length; i++) {
      for (let j = i + 1; j < identity.length; j++) {
        const a = b.palette[`${identity[i]}-600` as keyof typeof b.palette]!;
        const c = b.palette[`${identity[j]}-600` as keyof typeof b.palette]!;
        const d = deltaE(a, c);
        assert.ok(d >= MIN_DELTA_E, `${key}: ${identity[i]} and ${identity[j]} are ΔE ${d.toFixed(1)} apart at 600`);
      }
    }
  });

  test(`${key}: every ramp darkens at every step`, () => {
    // A ramp that doubles back gives a hover state lighter than its rest
    // state, which reads as the button switching off when you touch it.
    for (const name of RAMPS) {
      const r = Object.fromEntries(STEPS.map((s) => [s, b.palette[`${name}-${s}` as keyof typeof b.palette]]));
      assert.ok(isMonotonic(r), `${key}: ramp "${name}" is not monotonic`);
    }
  });

  test(`${key}: a step means the same weight whichever ramp it is`, () => {
    // This is what lets one component swap brand-600 for ok-600 and keep its
    // weight — and it is exactly what hand-mixed hex ramps never achieve.
    for (const step of [300, 600, 900] as const) {
      const ls = RAMPS.map((n) => hexToOklch(b.palette[`${n}-${step}` as keyof typeof b.palette]).L);
      const spread = Math.max(...ls) - Math.min(...ls);
      assert.ok(spread < 0.06, `${key}: step ${step} varies by ${spread.toFixed(3)} in lightness across ramps`);
    }
  });

  test(`${key}: config validates`, () => {
    assert.doesNotThrow(() => validateBrand(b));
  });
}

test("the amber-warning-on-a-gold-brand mistake is actually caught", () => {
  assert.ok(deltaE("#D97706", "#C9A227") < 38, "amber warn should be rejected");
  assert.ok(deltaE("#E6C200", "#C9A227") < 38, "yellow warn should be rejected");
  assert.ok(deltaE("#9C4A1E", "#C9A227") >= 38, "terracotta warn should be accepted");
});
