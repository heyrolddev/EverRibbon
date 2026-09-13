import test from "node:test";
import assert from "node:assert/strict";
import { classify, KEEP } from "../scripts/vercel-cleanup.mjs";

/**
 * The safety rules of a script that deletes things from a live account.
 *
 * A mistake here takes a working business offline, so the rules are tested
 * against fixtures rather than discovered against production. The shape of
 * every test below is the same question: given a deployment that matters,
 * does the script leave it alone?
 */

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 13);

const dep = (over: Record<string, unknown> = {}) => ({
  uid: `dpl_${Math.random().toString(36).slice(2, 9)}`,
  target: "preview",
  state: "READY",
  created: NOW - 90 * DAY,
  aliasAssigned: false,
  ...over,
});

const run = (list: ReturnType<typeof dep>[], over = {}) =>
  classify(list, { liveId: "dpl_live", now: NOW, ...over });

test("the deployment serving production is never deleted, however old", () => {
  const live = dep({ uid: "dpl_live", target: "production", created: NOW - 900 * DAY });
  const [out] = run([live]);
  assert.ok(out, "classify must return a verdict for every deployment it is given");
  assert.equal(out.action, "keep");
  assert.equal(out.why, KEEP.LIVE);
});

test("the live deployment is safe even when its build is recorded as failed", () => {
  // A stale or odd state field must never outrank "this is what is serving".
  const live = dep({ uid: "dpl_live", target: "production", state: "ERROR" });
  assert.equal(run([live])[0]!.action, "keep");
});

test("anything a domain points at is kept", () => {
  const aliased = dep({ aliasAssigned: true, created: NOW - 900 * DAY });
  const byList = dep({ alias: ["staging.example.com"], created: NOW - 900 * DAY });
  for (const out of run([aliased, byList])) {
    assert.equal(out.action, "keep");
    assert.equal(out.why, KEEP.ALIASED);
  }
});

test("failed and cancelled builds are deleted — they never served anything", () => {
  const list = [dep({ state: "ERROR" }), dep({ state: "CANCELED" }), dep({ state: "CANCELLED" })];
  for (const out of run(list)) assert.equal(out.action, "delete");
});

test("the newest production builds are kept so rollback still works", () => {
  const list = [
    dep({ uid: "dpl_live", target: "production", created: NOW - 1 * DAY }),
    dep({ uid: "p2", target: "production", created: NOW - 2 * DAY }),
    dep({ uid: "p3", target: "production", created: NOW - 3 * DAY }),
    dep({ uid: "p4", target: "production", created: NOW - 4 * DAY }),
    dep({ uid: "p5", target: "production", created: NOW - 5 * DAY }),
  ];
  const out = Object.fromEntries(run(list).map((d) => [d.uid, d.action]));
  assert.equal(out["dpl_live"], "keep");
  assert.equal(out["p2"], "keep");
  assert.equal(out["p3"], "keep");
  assert.equal(out["p4"], "delete");
  assert.equal(out["p5"], "delete");
});

test("rollback headroom counts the live build, and is adjustable", () => {
  const list = [
    dep({ uid: "dpl_live", target: "production", created: NOW - 1 * DAY }),
    dep({ uid: "p2", target: "production", created: NOW - 2 * DAY }),
  ];
  const out = Object.fromEntries(run(list, { keepProduction: 1 }).map((d) => [d.uid, d.action]));
  assert.equal(out["dpl_live"], "keep", "the live one is kept by identity, not by count");
  assert.equal(out["p2"], "delete");
});

test("recent previews are left alone; old ones go", () => {
  const fresh = dep({ created: NOW - 2 * DAY });
  const stale = dep({ created: NOW - 30 * DAY });
  const out = run([fresh, stale]);
  assert.equal(out[0]!.action, "keep");
  assert.equal(out[1]!.action, "delete");
});

test("a deployment with no target is treated as a preview, not as unknown", () => {
  // Older records come back without `target` at all. Ageing them out is right;
  // guessing they are production would keep the storage problem forever.
  const out = run([dep({ target: undefined, created: NOW - 30 * DAY })]);
  assert.equal(out[0]!.action, "delete");
});

test("anything the rules do not recognise is kept, not deleted", () => {
  // The failure mode that matters: if Vercel adds a target type, this script
  // must do nothing with it rather than assume it is disposable.
  const out = run([dep({ target: "some-new-thing", created: NOW - 900 * DAY })]);
  assert.equal(out[0]!.action, "keep");
  assert.equal(out[0]!.why, KEEP.UNKNOWN);
});

test("it refuses to classify at all without knowing what is live", () => {
  // Fail closed. A run that cannot identify the live deployment must stop,
  // not fall back to "delete the old-looking ones".
  assert.throws(() => classify([dep()], { liveId: undefined as unknown as string }), /refusing/i);
  assert.throws(() => classify([dep()], { liveId: "" }), /refusing/i);
});

test("a realistic account: the live site survives and the bulk is reclaimed", () => {
  const list = [
    dep({ uid: "dpl_live", target: "production", created: NOW - 1 * DAY }),
    ...Array.from({ length: 4 }, (_, i) =>
      dep({ uid: `prod${i}`, target: "production", created: NOW - (2 + i) * DAY })),
    ...Array.from({ length: 150 }, () => dep({ created: NOW - 60 * DAY })),
    ...Array.from({ length: 40 }, () => dep({ state: "ERROR", created: NOW - 60 * DAY })),
    dep({ uid: "shared", aliasAssigned: true, created: NOW - 200 * DAY }),
  ];
  const out = run(list);
  const kept = out.filter((d) => d.action === "keep");
  assert.ok(kept.some((d) => d.uid === "dpl_live"), "the live site must survive");
  assert.ok(kept.some((d) => d.uid === "shared"), "the aliased one must survive");
  assert.equal(kept.length, 4, "live + two rollbacks + the aliased one");
  assert.equal(out.length - kept.length, 192, "196 in, 4 kept");
});
