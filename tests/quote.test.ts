import test from "node:test";
import assert from "node:assert/strict";
import { quote, priceFor, marginAt, type QuoteInput } from "../src/lib/quote.ts";
import { OPERATING_DEFAULTS } from "../src/lib/operating.ts";

/**
 * The numbers here are the shop's real ones, so a change that breaks the
 * arithmetic breaks against work that actually happened rather than against
 * a round number chosen to make the test pass.
 *
 *   540 minutes of measured batch work yielded 100 flowers  -> 5.40 min each
 *   a 3-stem bouquet is 3 flowers                           -> 16.2 min
 */
const op = {
  ...OPERATING_DEFAULTS,
  labourRatePerHour: 100, // ₱1.6667 a minute
  consumablesPerUnit: 5,
  consumablesPerOrder: 20,
  depositEnabled: true,
  depositPercent: 50,
};

const base: QuoteInput = {
  lines: [],
  uplift: { kind: "margin", percent: 60 },
  deliveryFee: 0,
  discount: 0,
  rushFeePercent: 0,
  op,
};

const line = (over: Partial<QuoteInput["lines"][number]> = {}) => ({
  label: "3-stem bouquet",
  qty: 1,
  minutesEach: 16.2,
  materialsEach: 45,
  priceEach: null,
  ...over,
});

const near = (a: number, b: number, msg: string, eps = 0.005) =>
  assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);

test("a line costs materials, labour and per-unit consumables", () => {
  const r = quote({ ...base, lines: [line()] });
  near(r.cost.materials, 45, "materials");
  near(r.cost.labour, 16.2 * (100 / 60), "labour"); // 27.00
  // 5 on the unit, 20 on the order.
  near(r.cost.consumables, 25, "consumables");
  near(r.cost.total, 45 + 27 + 25, "total cost");
});

test("the per-order charge is added once, however many lines there are", () => {
  const one = quote({ ...base, lines: [line({ qty: 4 })] });
  const four = quote({
    ...base,
    lines: [line(), line(), line(), line()],
  });
  // Same four units either way, so the same tape.
  near(one.cost.consumables, four.cost.consumables, "consumables");
  near(one.cost.total, four.cost.total, "cost");
});

test("margin and markup are different prices from the same cost", () => {
  near(priceFor(100, "margin", 50), 200, "50% margin");
  near(priceFor(100, "markup", 50), 150, "50% markup");
  // The whole reason the distinction is recorded rather than guessed.
  assert.notEqual(priceFor(100, "margin", 50), priceFor(100, "markup", 50));
});

test("a derived price reaches the margin it was asked for", () => {
  const r = quote({ ...base, lines: [line()], uplift: { kind: "margin", percent: 60 } });
  near(r.marginPercent, 60, "margin reached");
  assert.equal(r.lines[0]?.derived, true);
});

test("a hand-priced line is left exactly as typed", () => {
  const r = quote({ ...base, lines: [line({ priceEach: 250, qty: 2 })] });
  near(r.goods, 500, "goods");
  assert.equal(r.lines[0]?.derived, false);
});

test("one line can be hand-priced while the rest follow the target", () => {
  const r = quote({
    ...base,
    lines: [line(), line({ label: "Printed ribbon", priceEach: 120 })],
  });
  assert.equal(r.lines[0]?.derived, true);
  assert.equal(r.lines[1]?.derived, false);
  near(r.lines[1]?.price ?? 0, 120, "the negotiated line");
});

test("the rush fee lands on the goods and not on delivery", () => {
  const r = quote({
    ...base,
    lines: [line({ priceEach: 1000 })],
    deliveryFee: 200,
    rushFeePercent: 10,
  });
  near(r.rushFee, 100, "10% of the goods only");
  near(r.total, 1000 + 100 + 200, "total");
});

test("the deposit is a share of what is actually owed, after the discount", () => {
  const r = quote({
    ...base,
    lines: [line({ priceEach: 1000 })],
    discount: 200,
  });
  near(r.total, 800, "total");
  near(r.deposit, 400, "deposit");
  near(r.balance, 400, "balance");
});

test("no deposit is asked for when the shop does not take one", () => {
  const r = quote({
    ...base,
    lines: [line({ priceEach: 1000 })],
    op: { ...op, depositEnabled: false },
  });
  assert.equal(r.deposit, 0);
  near(r.balance, r.total, "the whole thing is due");
});

test("a discount cannot exceed what is owed", () => {
  const r = quote({ ...base, lines: [line({ priceEach: 100 })], discount: 5000 });
  assert.equal(r.total, 0);
  assert.ok(r.total >= 0, "a quote never owes the customer money");
});

test("an uncosted hour is called out rather than priced as profit", () => {
  const r = quote({
    ...base,
    lines: [line()],
    op: { ...op, labourRatePerHour: 0 },
  });
  assert.equal(r.cost.labour, 0);
  assert.ok(
    r.warnings.some((w) => w.includes("Labour is not costed")),
    `expected a labour warning, got ${JSON.stringify(r.warnings)}`
  );
});

test("a quote with no materials says so instead of reading as all profit", () => {
  const r = quote({ ...base, lines: [line({ materialsEach: 0 })] });
  assert.ok(r.warnings.some((w) => w.includes("No material cost")));
});

test("selling below cost is stated plainly", () => {
  const r = quote({ ...base, lines: [line({ priceEach: 10 })] });
  assert.ok(r.profit < 0);
  assert.ok(r.warnings.some((w) => w.includes("sells at a loss")));
});

test("a margin of 100% is refused rather than rendered as infinity", () => {
  const r = quote({
    ...base,
    lines: [line()],
    uplift: { kind: "margin", percent: 100 },
  });
  assert.ok(Number.isFinite(r.total), "the total is a number");
  assert.ok(r.warnings.some((w) => w.includes("no price that reaches it")));
});

test("minutes are what the calendar books, not a count of items", () => {
  const r = quote({
    ...base,
    lines: [line({ qty: 3 }), line({ label: "Ribbon", minutesEach: 2, qty: 10 })],
  });
  near(r.minutes, 16.2 * 3 + 2 * 10, "total minutes");
});

test("an empty quote is empty, not free", () => {
  const r = quote({ ...base });
  assert.equal(r.total, 0);
  assert.equal(r.marginPercent, 0, "no percentage of nothing");
  assert.equal(r.markupPercent, 0);
  assert.ok(r.warnings.some((w) => w.includes("Nothing on this quote")));
});

test("marginAt reads a typed price both ways", () => {
  const { margin, markup } = marginAt(200, 100);
  near(margin, 50, "margin");
  near(markup, 100, "markup");
});

test("the shop's own underpriced product is visibly underpriced", () => {
  // The 3-stem sold at ₱175 against the ₱97 it costs to make: 44.6% where
  // everything else in the same spreadsheet sat between 57% and 62%.
  const r = quote({ ...base, lines: [line({ priceEach: 175 })] });
  near(r.cost.total, 97, "measured cost");
  assert.ok(r.marginPercent < 50, `expected under 50%, got ${r.marginPercent}`);

  // Priced at the target instead, the same bouquet asks for more.
  const fixed = quote({ ...base, lines: [line()] });
  assert.ok(
    fixed.total > 175,
    `the target price should exceed the hand price: ${fixed.total}`
  );
});

test("the deposit and the balance add up to the total, to the centavo", () => {
  // ₱1,742.25 at 50% is ₱871.125 — rounded twice it is ₱871.13 twice, and
  // the quote asks for one centavo more than it charges.
  const r = quote({
    ...base,
    lines: [line({ priceEach: 1515 })],
    rushFeePercent: 15,
  });
  near(r.total, 1742.25, "total");
  assert.equal(
    Math.round((r.deposit + r.balance) * 100) / 100,
    Math.round(r.total * 100) / 100,
    `deposit ${r.deposit} + balance ${r.balance} must equal ${r.total}`
  );
  // And the deposit is an amount that can actually be transferred.
  assert.equal(r.deposit, Math.round(r.deposit * 100) / 100);
});
