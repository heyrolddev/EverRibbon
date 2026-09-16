import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_STATUSES, keysOf, openKeys, gateKeys, committedKeys,
  labelOf, toneOf, isOpen, isGate, statusesFor, toneClasses, STATUS_TONES,
  type OrderStatusRow,
} from "../src/lib/order-statuses.ts";

/**
 * The steps are data now, so what used to be three constant arrays is logic,
 * and logic is testable. These cover the questions the code asks of a status
 * and the answers that used to be hardcoded per shop.
 */

/** The flow a made-to-order shop actually runs — see the seed. */
const RIBBON: OrderStatusRow[] = [
  { key: "inquiry",       label: "Inquiry",       sortOrder: 10,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: false, tone: "ink",    hint: null },
  { key: "agreed",        label: "Agreed",        sortOrder: 30,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: false, tone: "accent", hint: "Waiting on the deposit." },
  { key: "deposit_paid",  label: "Deposit paid",  sortOrder: 40,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  tone: "ok",     hint: null },
  { key: "proof_sent",    label: "Proof sent",    sortOrder: 50,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: true,  tone: "accent", hint: null },
  { key: "in_production", label: "In production", sortOrder: 70,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  tone: "brand",  hint: null },
  { key: "delivered",     label: "Delivered",     sortOrder: 100, isOpen: false, isGate: false, deliveryOnly: true,  commitsStock: true,  tone: "ink",    hint: null },
  { key: "cancelled",     label: "Cancelled",     sortOrder: 110, isOpen: false, isGate: false, deliveryOnly: false, commitsStock: false, tone: "bad",    hint: null },
];

test("the steps come back in the order the shop works through them", () => {
  const shuffled = [...RIBBON].reverse();
  assert.deepEqual(keysOf(shuffled), [
    "inquiry", "agreed", "deposit_paid", "proof_sent", "in_production", "delivered", "cancelled",
  ]);
});

test("what is still owed is asked of the data, not of a second list", () => {
  assert.deepEqual(openKeys(RIBBON), ["inquiry", "agreed", "deposit_paid", "proof_sent", "in_production"]);
  assert.equal(isOpen(RIBBON, "delivered"), false);
  assert.equal(isOpen(RIBBON, "in_production"), true);
});

test("a gate is a step nothing proceeds past on its own", () => {
  assert.deepEqual(gateKeys(RIBBON), ["agreed", "proof_sent"]);
  assert.equal(isGate(RIBBON, "proof_sent"), true, "nothing is printed before the customer approves");
  assert.equal(isGate(RIBBON, "in_production"), false);
});

test("stock is committed from the shop's own step, not from a name in the code", () => {
  /*
   * This is the case that made the column necessary. The stock code matched
   * four names — confirmed, preparing, ready, completed — none of which this
   * shop uses. Its materials would have stayed on the shelf through the whole
   * build: nothing would fail, the counts would just read high.
   */
  assert.deepEqual(committedKeys(RIBBON),
    ["deposit_paid", "proof_sent", "in_production", "delivered"]);
  assert.equal(committedKeys(RIBBON).includes("agreed"), false,
    "an agreement with no deposit has not cut any ribbon");
});

test("a pick-up is never offered a delivery step", () => {
  // Offering a step staff can never legitimately use is worse than hiding it:
  // somebody presses it, and the customer is told their order is on its way to
  // an address nobody has.
  const pickup = statusesFor(RIBBON, "pickup").map((r) => r.key);
  const delivery = statusesFor(RIBBON, "delivery").map((r) => r.key);
  assert.equal(pickup.includes("delivered"), false);
  assert.equal(delivery.includes("delivered"), true);
});

test("an unknown status renders as itself rather than as blank", () => {
  // A row whose status was renamed in the database mid-request still has to
  // draw. Blank reads as a bug; the raw key reads as a status nobody labelled.
  assert.equal(labelOf(RIBBON, "quoted"), "quoted");
  assert.equal(toneOf(RIBBON, "quoted"), "ink");
  assert.equal(isOpen(RIBBON, "quoted"), false, "unknown is not assumed to be live work");
});

test("every tone has classes, and they are tokens rather than colours", () => {
  for (const tone of STATUS_TONES) {
    const c = toneClasses(tone);
    for (const part of [c.chip, c.dot, c.rail]) {
      assert.ok(part.length > 0, `${tone} is missing a class`);
      assert.doesNotMatch(part, /#[0-9a-f]{3,8}/i, `${tone} names a colour instead of a token`);
    }
  }
});

test("the fallback is a working flow, not an empty one", () => {
  // It exists so a database that has not run migration 0007 still draws a
  // board. A fallback that is itself broken is worse than none.
  assert.ok(FALLBACK_STATUSES.length >= 5);
  assert.ok(openKeys(FALLBACK_STATUSES).length >= 1);
  assert.ok(committedKeys(FALLBACK_STATUSES).length >= 1, "stock must commit somewhere");
  for (const r of FALLBACK_STATUSES) {
    assert.ok(STATUS_TONES.includes(r.tone), `${r.key} has tone "${r.tone}"`);
    assert.match(r.key, /^[a-z][a-z0-9_]*$/, `${r.key} must match the database's key shape`);
  }
});
