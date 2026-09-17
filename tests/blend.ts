/**
 * A translucent colour over an opaque one, as the colour you actually see.
 *
 * Contrast is a property of what lands on the screen, and a Tailwind class
 * like `bg-ok-400/40` never puts `ok-400` on the screen — it puts four parts
 * of it over six parts of whatever is behind. Measuring the unblended colour
 * answers a question nobody asked.
 *
 * Straight alpha over an opaque backdrop, in sRGB, which is what a browser
 * composites. No gamma correction on purpose: the browser does not do it
 * either, so matching it matters more here than being right in the abstract.
 */
const channels = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

export function blend(over: string, alpha: number, under: string): string {
  const a = Math.min(1, Math.max(0, alpha));
  const f = channels(over);
  const b = channels(under);
  const mix = f.map((v, i) => Math.round(v * a + (b[i] ?? 0) * (1 - a)));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
