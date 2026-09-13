/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Lives beside the tests rather than in `src/` because it is a property of the
 * brand config, checked once in CI — not something a page renders.
 */
/** `#rrggbb` to three 0-255 channels, refusing anything else. */
function channels(hex: string): [number, number, number] {
  const parts = hex.replace("#", "").match(/../g);
  if (!parts || parts.length < 3) throw new Error(`not a 6-digit hex colour: "${hex}"`);
  return [parseInt(parts[0]!, 16), parseInt(parts[1]!, 16), parseInt(parts[2]!, 16)];
}

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * CIE76 ΔE — "would a person call these two different colours?"
 *
 * Contrast ratio cannot answer that: it only measures lightness, so gold and
 * amber score 1.23:1 against each other and look identical to the maths while
 * being the exact confusion a UI must avoid. ΔE works in a perceptual space,
 * where the two real palettes here score 41-72 and the mistakes score 20-31.
 */
function lab(hex: string): [number, number, number] {
  const [R, G, B] = channels(hex);
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [f(R), f(G), f(B)];
  const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = k((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const Y = k(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const Z = k((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

export function deltaE(a: string, b: string): number {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
