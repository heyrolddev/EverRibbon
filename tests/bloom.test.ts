import test from "node:test";
import assert from "node:assert/strict";
import { bloom, knotRadius, petalPath, rotate, tailPath } from "../src/lib/bloom.ts";

/** Every number in a path string, in order. */
const numbers = (d: string): number[] =>
  (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

const close = (a: number, b: number, within = 0.02) =>
  assert.ok(Math.abs(a - b) <= within, `${a} is not within ${within} of ${b}`);

test("a quarter turn is a quarter turn", () => {
  const [x, y] = rotate([0, -10], 90);
  close(x, 10);
  close(y, 0);
  // And a full turn is where it started, which is what the rings rely on.
  const [a, b] = rotate([3, -7], 360);
  close(a, 3);
  close(b, -7);
});

test("a petal is two closed subpaths — the outline and its hole", () => {
  // The hole is what makes it a ribbon LOOP rather than a leaf. One subpath
  // and the whole thing goes solid and reads as foliage.
  const d = petalPath(
    { reach: 90, waist: 27, lift: 0.58, twist: 0.3, hollow: 0.52 },
    0
  );
  assert.equal(d.match(/M/g)?.length, 2);
  assert.equal(d.match(/Z/g)?.length, 2);
});

test("the hole stays inside the petal", () => {
  // A hole that escapes its outline does not render as a hole; it renders as
  // a gash. Checked at the extremes, which is where it would escape first.
  const shape = { reach: 90, waist: 27, lift: 0.58, twist: 0.3, hollow: 0.52 };
  const d = petalPath(shape, 0);
  const all = numbers(d);
  const ys = all.filter((_, i) => i % 2 === 1);
  const xs = all.filter((_, i) => i % 2 === 0);
  // Pointing straight up, so nothing may reach past the tip or behind the
  // centre, and nothing may be wider than the waist.
  assert.ok(Math.min(...ys) >= -shape.reach - 0.01);
  assert.ok(Math.max(...ys) <= 0.01);
  assert.ok(Math.max(...xs.map(Math.abs)) <= shape.waist * (1 + shape.twist) + 0.01);
});

test("a petal with no twist is symmetrical, and twist is what breaks it", () => {
  // Symmetry is the tell that separates a leaf from a folded band of ribbon.
  const flat = numbers(petalPath({ reach: 80, waist: 24, lift: 0.6, twist: 0, hollow: 0.5 }, 0));
  const xs = flat.filter((_, i) => i % 2 === 0);
  close(Math.max(...xs), -Math.min(...xs));

  const twisted = numbers(petalPath({ reach: 80, waist: 24, lift: 0.6, twist: 0.35, hollow: 0.5 }, 0));
  const tx = twisted.filter((_, i) => i % 2 === 0);
  assert.notEqual(
    Math.round(Math.max(...tx) * 10),
    Math.round(-Math.min(...tx) * 10)
  );
});

test("three rings, each smaller and set in the gaps of the last", () => {
  const rings = bloom({ radius: 96, petals: 11 });
  assert.equal(rings.length, 3);
  assert.deepEqual(rings.map((r) => r.petals.length), [11, 8, 5]);

  // Offset, or the rings line up and the thing reads as concentric wheels.
  const firstAngleOf = (d: string) => Math.atan2(numbers(d)[3] ?? 0, numbers(d)[2] ?? 0);
  assert.notEqual(
    Math.round(firstAngleOf(rings[0]!.petals[0]!) * 100),
    Math.round(firstAngleOf(rings[1]!.petals[0]!) * 100)
  );
});

test("the rings do not all drift the same way", () => {
  // Two rings turning together read as one spinning object. Opposite ways is
  // what makes it read as alive, and it is the only reason spin is signed.
  const spins = bloom().map((r) => Math.sign(r.spin));
  assert.ok(new Set(spins).size > 1);
  assert.ok(bloom().every((r) => r.spin !== 0));
});

test("the near ring moves most under the pointer", () => {
  // Parallax the wrong way round reads as a mistake rather than as depth.
  const depths = bloom().map((r) => r.depth);
  assert.deepEqual([...depths].sort((a, b) => a - b), depths);
});

test("a bloom is never asked for fewer petals than it can draw", () => {
  // The inner rings subtract from the outer count, and a ring of one petal is
  // a blob. Three is the floor, and it holds however few are asked for.
  const rings = bloom({ petals: 4 });
  assert.ok(rings.every((r) => r.petals.length >= 3));
});

test("a tail is one closed band with a notch cut into the end", () => {
  // A stroked curve has square ends and one width. The swallowtail notch is
  // the detail that makes this read as ribbon at a glance, so it is not
  // decoration that can quietly go missing.
  const d = tailPath(1, 120, 20);
  assert.equal(d.match(/M/g)?.length, 1);
  assert.equal(d.match(/Z/g)?.length, 1);
  const ys = numbers(d).filter((_, i) => i % 2 === 1);
  // The notch cuts back up from the lowest point, so the end is not flat.
  assert.ok(Math.max(...ys) > 0);
  assert.ok(Math.max(...ys) - Math.min(...ys.filter((y) => y > 60)) > 1);
});

test("the two tails mirror each other", () => {
  const right = numbers(tailPath(1, 120, 20));
  const left = numbers(tailPath(-1, 120, 20));
  assert.equal(right.length, left.length);
  for (let i = 0; i < right.length; i += 2) {
    close(right[i]!, -left[i]!);
    // Same distance down the page, both of them.
    close(right[i + 1]!, left[i + 1]!);
  }
});

test("nothing in the artwork is NaN", () => {
  // One NaN anywhere in a path and the browser drops the whole path — the
  // hero renders empty and nothing reports a thing.
  const all = [
    ...bloom().flatMap((r) => r.petals),
    tailPath(1, 120, 20),
    tailPath(-1, 120, 20),
  ];
  for (const d of all) {
    assert.ok(!d.includes("NaN"), d.slice(0, 60));
    assert.ok(numbers(d).every(Number.isFinite));
  }
  assert.ok(knotRadius(96) > 0);
});
