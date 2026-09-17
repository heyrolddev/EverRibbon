/**
 * A bloom made of ribbon.
 *
 * The one piece of artwork on this site that is computed rather than
 * uploaded. Every petal is a loop of ribbon — an outline with a hole in it,
 * the way a bow loop is a hole — arranged in rings around a knot, with two
 * tails falling out of the bottom. Read one way it is a flower; read the
 * other it is a bow. This shop sells both, which is the whole reason to draw
 * it rather than photograph it.
 *
 * Three reasons it is geometry and not an image:
 *
 *   It is there on day one. A shop that has uploaded nothing still has a
 *   hero, which is the state this entire codebase is built to survive.
 *
 *   It costs nothing. No megabyte, no layout shift, no second art file for
 *   the retina screen — and it is sharp at any size on any phone.
 *
 *   It takes the brand's colours from the tokens, so the next shop to use
 *   this template gets its own bloom rather than somebody else's gold.
 *
 * Pure: numbers in, path strings out. The component does the animating.
 */

export type Pt = readonly [number, number];

/** Two decimals is under a thousandth of the viewBox. Anything more is bytes. */
const n = (v: number) => (Math.round(v * 100) / 100).toString();
const pt = ([x, y]: Pt) => `${n(x)} ${n(y)}`;

/** A point turned about the origin. Degrees, clockwise on screen. */
export function rotate([x, y]: Pt, degrees: number): Pt {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [x * cos - y * sin, x * sin + y * cos];
}

export type PetalShape = {
  /** Centre to tip. */
  reach: number;
  /** Widest across. */
  waist: number;
  /** Where along the length the widest point sits, 0 at the centre, 1 at the tip. */
  lift: number;
  /**
   * How far off symmetrical the two sides are.
   *
   * Zero draws a leaf. A little of this is what makes it read as a folded
   * band of ribbon instead — the side you can see more of is the side facing
   * you, and a ribbon that is perfectly symmetrical is a ribbon lying flat.
   */
  twist: number;
  /** The hole, as a fraction of the petal. Below about 0.3 it stops reading as a loop. */
  hollow: number;
};

/**
 * One petal, pointing straight up, as a closed outline.
 *
 * Up rather than along +x because the whole thing is then rotated into place,
 * and "up" is the direction anybody sketching a petal draws first.
 */
function outline({ reach, waist, lift, twist }: Omit<PetalShape, "hollow">): Pt[] {
  const left = waist * (1 - twist);
  const right = waist * (1 + twist);
  return [
    [0, 0],
    [-left, -reach * lift],
    [-waist * 0.42, -reach],
    [0, -reach],
    [right * 0.42, -reach],
    [right, -reach * lift * 0.92],
    [0, 0],
  ];
}

const curve = (p: Pt[], angle: number): string => {
  const [start, ...rest] = p.map((q) => rotate(q, angle));
  if (!start) return "";
  let d = `M${pt(start)}`;
  for (let i = 0; i + 2 < rest.length + 1; i += 3) {
    const a = rest[i];
    const b = rest[i + 1];
    const c = rest[i + 2];
    if (!a || !b || !c) break;
    d += `C${pt(a)},${pt(b)},${pt(c)}`;
  }
  return `${d}Z`;
};

/**
 * A petal as a ribbon loop: an outer outline with a smaller one inside it.
 *
 * Both subpaths wind the same way and the path is filled `evenodd`, which is
 * what turns the inner one into a hole rather than a second petal drawn on
 * top. The hole is pushed toward the tip so the band is thicker where the
 * loop is pinched, which is where a real one is thicker.
 */
export function petalPath(shape: PetalShape, angle: number): string {
  const solid = outline(shape);
  const inner = outline({
    reach: shape.reach * shape.hollow,
    waist: shape.waist * shape.hollow,
    lift: shape.lift,
    twist: shape.twist,
  }).map(([x, y]) => [x, y - shape.reach * (1 - shape.hollow) * 0.52] as Pt);

  return `${curve(solid, angle)}${curve(inner, angle)}`;
}

export type BloomLayer = {
  id: string;
  /** Every petal in this ring, already rotated into place. */
  petals: string[];
  /**
   * Seconds for one full turn. Negative turns the other way, which is the
   * entire trick: two rings drifting the same way read as one spinning
   * object, and opposite ways read as something alive.
   */
  spin: number;
  opacity: number;
  /** How far this ring moves under the pointer. The near ring moves most. */
  depth: number;
};

export type BloomOptions = {
  /** Half the viewBox. The outermost petals reach roughly this far. */
  radius?: number;
  /** Petals in the outer ring. Odd numbers read as grown rather than machined. */
  petals?: number;
};

/**
 * The rings, outermost first.
 *
 * Each ring inside the last has fewer, smaller petals, turned to sit in the
 * gaps of the one outside it — which is how a real flower stops looking like
 * concentric wheels.
 */
export function bloom({ radius = 96, petals = 11 }: BloomOptions = {}): BloomLayer[] {
  const rings: { count: number; scale: number; spin: number; opacity: number; depth: number }[] = [
    { count: petals, scale: 1, spin: 150, opacity: 0.62, depth: 6 },
    { count: Math.max(3, petals - 3), scale: 0.72, spin: -108, opacity: 0.8, depth: 12 },
    { count: Math.max(3, petals - 6), scale: 0.47, spin: 84, opacity: 1, depth: 20 },
  ];

  return rings.map((ring, i) => {
    const step = 360 / ring.count;
    // Half a step of offset per ring, so each sits in the gaps of the last.
    const offset = i * step * 0.5;
    const shape: PetalShape = {
      reach: radius * ring.scale,
      waist: radius * ring.scale * 0.3,
      lift: 0.58,
      // The inner rings are seen more face-on, so they are twisted less.
      twist: 0.34 - i * 0.09,
      hollow: 0.52 + i * 0.04,
    };
    return {
      id: `ring-${i}`,
      petals: Array.from({ length: ring.count }, (_, k) =>
        petalPath(shape, offset + k * step)
      ),
      spin: ring.spin,
      opacity: ring.opacity,
      depth: ring.depth,
    };
  });
}

/* ---------------------------------------------------------------- tails -- */

const cubic = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [
    a[0] * w[0] + b[0] * w[1] + c[0] * w[2] + d[0] * w[3],
    a[1] * w[0] + b[1] * w[1] + c[1] * w[2] + d[1] * w[3],
  ];
};

/**
 * A tail, as a band of real width rather than a thick stroke.
 *
 * A stroked curve has square or round ends and a constant width; a ribbon has
 * neither. So the centreline is sampled, offset either side by a width that
 * tapers, and closed with the swallowtail notch — the V cut into the end of
 * every ribbon anybody has ever tied, and the single detail that makes this
 * read as ribbon at a glance.
 */
export function tailPath(side: 1 | -1, length: number, width: number): string {
  // Built once for the right-hand side and mirrored at the end, rather than
  // built twice from a signed constant. Offsetting a curve involves its
  // normal, and a normal does not simply flip when you negate x — so the two
  // tails came out subtly different shapes, which on a bow is exactly the
  // thing an eye catches without being able to say why.
  // Out, back across itself, then out again — the lazy S a hanging ribbon
  // falls into. A single arc reads as a leg.
  const a: Pt = [width * 0.25, 0];
  const b: Pt = [width * 3.1, length * 0.3];
  const c: Pt = [-width * 1.4, length * 0.7];
  const d: Pt = [width * 3.4, length];

  const STEPS = 18;
  const left: Pt[] = [];
  const right: Pt[] = [];

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const p = cubic(a, b, c, d, t);
    // The tangent, from a neighbour close enough that the curve is a line
    // between them.
    const q = cubic(a, b, c, d, Math.min(1, t + 0.001));
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // Narrow where it leaves the knot, widest two thirds down, and only
    // slightly narrower at the cut end — a tail that tapers to a point is a
    // leaf again.
    const w = (width * (0.55 + 0.45 * Math.sin(t * Math.PI * 0.85))) / 2;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    left.push([p[0] + nx, p[1] + ny]);
    right.push([p[0] - nx, p[1] - ny]);
  }

  const end = cubic(a, b, c, d, 1);
  const notch: Pt = [end[0], end[1] - width * 0.62];

  const flip = ([x, y]: Pt): Pt => [side * x, y];
  const line = (ps: Pt[]) => ps.map((q) => `L${pt(flip(q))}`).join("");
  const first = left[0];
  if (!first) return "";
  return `M${pt(flip(first))}${line(left.slice(1))}L${pt(flip(notch))}${line([...right].reverse())}Z`;
}

/** The knot the whole thing hangs off, as a circle radius. */
export const knotRadius = (radius = 96) => radius * 0.13;
