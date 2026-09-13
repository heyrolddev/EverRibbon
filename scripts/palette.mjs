/**
 * Build a full colour ramp from one approved colour.
 *
 * A shop hands over a logo and two or three colours. What a UI needs is eleven
 * steps of each, evenly spaced in *perceived* lightness, so that a component
 * can swap one ramp for another and keep its weight. Mixing hex by hand gets
 * this wrong every time: sRGB interpolation darkens through mud, and a "500"
 * of one hue ends up visibly heavier than a "500" of the next.
 *
 * So the maths happens in OKLCH, where a fixed lightness stop means the same
 * apparent weight whatever the hue.
 *
 *     node scripts/palette.mjs "#C9A227"        # one ramp
 *     node scripts/palette.mjs "#C9A227" brand  # named for pasting into config
 */

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function hexToOklch(hex) {
  const [R, G, B] = hex.replace("#", "").match(/../g).map((h) => toLin(parseInt(h, 16) / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** Many OKLCH triples name colours a screen cannot show; walk chroma down. */
export function oklchToHex(L, C, h) {
  if (!inGamut(oklchToRgb(L, C, h))) {
    let lo = 0, hi = C;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToRgb(L, mid, h))) lo = mid; else hi = mid;
    }
    C = lo;
  }
  return "#" + oklchToRgb(L, C, h)
    .map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255).toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

/** Shared by every ramp, so a 600 is the same weight whatever the hue. */
export const STOPS = {
  50: 0.972, 100: 0.939, 200: 0.884, 300: 0.815, 400: 0.742,
  500: 0.664, 600: 0.575, 700: 0.487, 800: 0.396, 900: 0.303, 950: 0.223,
};
/** Neither near-white nor near-black can hold much saturation. */
const CHROMA = {
  50: 0.16, 100: 0.30, 200: 0.52, 300: 0.74, 400: 0.92,
  500: 1.00, 600: 0.97, 700: 0.87, 800: 0.73, 900: 0.56, 950: 0.40,
};

/**
 * The anchor keeps its exact hex, and the ramp bends to meet it.
 *
 * The step it lands on is measured, not chosen: a shop may call its red a 600,
 * but if the colour is perceptually a 700 then forcing it into 600 leaves 600
 * and 700 almost identical and the ramp has a dead rung. Returning `placedAt`
 * is what lets a port map old class names onto the right new ones.
 */
export function ramp(anchorHex) {
  const { L: aL, C, h } = hexToOklch(anchorHex);
  const steps = Object.keys(STOPS);
  const placedAt = steps.reduce((b, s) => (Math.abs(STOPS[s] - aL) < Math.abs(STOPS[b] - aL) ? s : b), steps[0]);
  const peak = C / CHROMA[placedAt];
  const out = {};
  for (const step of steps) {
    out[step] = step === placedAt ? anchorHex.toUpperCase() : oklchToHex(STOPS[step], peak * CHROMA[step], h);
  }
  return { ramp: out, placedAt };
}

/** A ramp must darken at every step, or a hover state can come out lighter. */
export function isMonotonic(r) {
  const ls = Object.keys(STOPS).map((s) => hexToOklch(r[s]).L);
  return ls.every((v, i) => i === 0 || v < ls[i - 1] - 0.004);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [hex, name = "ramp"] = process.argv.slice(2);
  if (!/^#[0-9a-fA-F]{6}$/.test(hex ?? "")) {
    console.error('usage: node scripts/palette.mjs "#RRGGBB" [name]');
    process.exit(1);
  }
  const { ramp: r, placedAt } = ramp(hex);
  console.log(Object.entries(r).map(([s, v]) => `"${name}-${s}": "${v}"`).join(", ") + ",");
  console.log(`// anchor lands at ${placedAt}; monotonic: ${isMonotonic(r)}`);
}
