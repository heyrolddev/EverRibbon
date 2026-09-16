import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_STATUSES, keysOf, openKeys, gateKeys, committedKeys,
  labelOf, toneOf, isOpen, isGate, statusesFor, toneClasses, STATUS_TONES,
  type OrderStatusRow,
  fulfilledKeys,
  isFulfilled,
  cancellationKeys,
  isCancellation,
  needsShop,
  awaitingCustomer,
  railFor,
  railIndex,
  workStartsAt,
  handedOverAt,
  processSteps,
} from "../src/lib/order-statuses.ts";

/**
 * The steps are data now, so what used to be three constant arrays is logic,
 * and logic is testable. These cover the questions the code asks of a status
 * and the answers that used to be hardcoded per shop.
 */

/** The flow a made-to-order shop actually runs — see the seed. */
const RIBBON: OrderStatusRow[] = [
  { key: "inquiry",       label: "Inquiry",       sortOrder: 10,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "agreed",        label: "Agreed",        sortOrder: 30,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: false, awaitingCustomer: true, customerNote: null, tone: "accent", hint: "Waiting on the deposit." },
  { key: "deposit_paid",  label: "Deposit paid",  sortOrder: 40,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ok",     hint: null },
  { key: "proof_sent",    label: "Proof sent",    sortOrder: 50,  isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: true, customerNote: null, tone: "accent", hint: null },
  { key: "in_production", label: "In production", sortOrder: 70,  isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "brand",  hint: null },
  // A shop that ships adds this; one that hands over at the counter does not.
  { key: "shipped",       label: "Shipped",       sortOrder: 95,  isOpen: true,  isGate: false, deliveryOnly: true,  commitsStock: true,  isFulfilled: false, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "delivered",     label: "Delivered",     sortOrder: 100, isOpen: false, isGate: false, deliveryOnly: false,  commitsStock: true,  isFulfilled: true, isCancellation: false, awaitingCustomer: false, customerNote: null, tone: "ink",    hint: null },
  { key: "cancelled",     label: "Cancelled",     sortOrder: 110, isOpen: false, isGate: false, deliveryOnly: false, commitsStock: false, isFulfilled: false, isCancellation: true, awaitingCustomer: false, customerNote: null, tone: "bad",    hint: null },
];

test("the steps come back in the order the shop works through them", () => {
  const shuffled = [...RIBBON].reverse();
  assert.deepEqual(keysOf(shuffled), [
    "inquiry", "agreed", "deposit_paid", "proof_sent", "in_production",
    "shipped", "delivered", "cancelled",
  ]);
});

test("what is still owed is asked of the data, not of a second list", () => {
  assert.deepEqual(openKeys(RIBBON), [
    "inquiry", "agreed", "deposit_paid", "proof_sent", "in_production", "shipped",
  ]);
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
    ["deposit_paid", "proof_sent", "in_production", "shipped", "delivered"]);
  assert.equal(committedKeys(RIBBON).includes("agreed"), false,
    "an agreement with no deposit has not cut any ribbon");
});

test("a pick-up is never offered a delivery step", () => {
  // Offering a step staff can never legitimately use is worse than hiding it:
  // somebody presses it, and the customer is told their order is on its way to
  // an address nobody has.
  const pickup = statusesFor(RIBBON, "pickup").map((r) => r.key);
  const delivery = statusesFor(RIBBON, "delivery").map((r) => r.key);
  assert.equal(pickup.includes("shipped"), false);
  assert.equal(delivery.includes("shipped"), true);
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

/**
 * The bug these guard against was found twice, and the second time it was in
 * the database as well as the app: two step names — 'completed' and
 * 'cancelled' — were doing semantic work in about twenty places. On a shop
 * whose last step is called 'delivered', every one of them matched nothing.
 *
 * Nothing errored. Revenue read zero, every customer read as a first-timer,
 * no purchase could be reviewed, and the dashboard reported that nothing
 * needed doing with a full board behind it. All of which looks like a quiet
 * shop rather than a broken one, which is why it survived.
 */

test("a shop that has no step called 'completed' still earns revenue", () => {
  assert.deepEqual(fulfilledKeys(RIBBON), ["delivered"]);
  assert.ok(isFulfilled(RIBBON, "delivered"));
  assert.ok(!isFulfilled(RIBBON, "completed"), "a step it does not have");
  assert.ok(!isFulfilled(RIBBON, "in_production"), "not finished is not fulfilled");
});

test("a shop names its own cancellation", () => {
  assert.deepEqual(cancellationKeys(RIBBON), ["cancelled"]);
  assert.ok(isCancellation(RIBBON, "cancelled"));
  assert.ok(!isCancellation(RIBBON, "delivered"));
});

test("whose move it is splits the open steps, and misses none", () => {
  const open = RIBBON.filter((r) => r.isOpen).map((r) => r.key);
  const mine = open.filter((k) => needsShop(RIBBON, k));
  const theirs = open.filter((k) => awaitingCustomer(RIBBON, k));
  // Every open order is on somebody. A step on neither list is an order
  // nobody is looking at, which is how one sits for a week.
  assert.deepEqual([...mine, ...theirs].sort(), [...open].sort());
  assert.ok(mine.includes("in_production"), "making it is the shop's move");
  assert.ok(mine.includes("shipped"), "in transit is still on the shop");
  assert.ok(theirs.includes("proof_sent"), "an unapproved proof is theirs");
});

test("the customer's rail is the shop's own steps, without the cancellation", () => {
  const rail = railFor(RIBBON, "pickup").map((r) => r.key);
  assert.ok(!rail.includes("cancelled"), "not a milestone to look forward to");
  // The rail has to end somewhere the customer is glad to arrive at.
  assert.equal(rail.at(-1), "delivered");
  assert.deepEqual(rail, [
    "inquiry", "agreed", "deposit_paid", "proof_sent", "in_production", "delivered",
  ]);
  // The same shop, shipping: one more milestone, in its place.
  assert.deepEqual(railFor(RIBBON, "delivery").map((r) => r.key), [
    "inquiry", "agreed", "deposit_paid", "proof_sent", "in_production",
    "shipped", "delivered",
  ]);
  assert.equal(railIndex(railFor(RIBBON, "pickup"), "proof_sent"), 3);
});

test("a step that is not on the rail reports as nowhere, not as the start", () => {
  // -1, so the progress bar draws nothing lit rather than lighting the first
  // segment and telling the customer their order has begun when it has not.
  assert.equal(railIndex(railFor(RIBBON, "pickup"), "cancelled"), -1);
});

test("the till finds a step to sell into on either shop", () => {
  assert.equal(workStartsAt(RIBBON), "deposit_paid");
  assert.equal(handedOverAt(RIBBON), "delivered");
  assert.equal(workStartsAt(FALLBACK_STATUSES), "confirmed");
  assert.equal(handedOverAt(FALLBACK_STATUSES), "completed");
});

test("the homepage's process section is decided by the data, not by an element", () => {
  // The shop's own steps, each with something to say to a customer.
  const withNotes = RIBBON.map((r) => ({ ...r, customerNote: `About ${r.label}.` }));
  assert.ok(processSteps(withNotes).length >= 2);
  // Cancellation is not a stage of an order, so it is never a milestone.
  assert.ok(!processSteps(withNotes).some((s) => s.isCancellation));
  // A shop that has written none gets no section rather than an empty one.
  assert.deepEqual(processSteps(RIBBON), []);
  // And one lonely step is not a process.
  const one = RIBBON.map((r, i) => ({ ...r, customerNote: i === 0 ? "Only this." : null }));
  assert.deepEqual(processSteps(one), []);
});
