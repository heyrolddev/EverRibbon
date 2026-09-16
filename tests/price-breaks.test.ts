import test from "node:test";
import assert from "node:assert/strict";
import {
  ladder,
  ladderRows,
  lineTotal,
  nextSaving,
  unitPriceAt,
  type PriceBreak,
} from "../src/lib/price-breaks.ts";

/**
 * The shop's own ribbon ladder, from its price list:
 *
 *   1/2" basic ink   1-4 rolls ₱500   5-9 rolls ₱450   10+ rolls ₱400
 *
 * Every figure below is read off that, so a change to the arithmetic breaks
 * against a real price list rather than against numbers chosen to pass.
 */
const HALF_INCH = 500;
const RUNGS: PriceBreak[] = [
  { minQty: 5, unitPrice: 450 },
  { minQty: 10, unitPrice: 400 },
];

test("below the first rung, the product's own price applies", () => {
  assert.equal(unitPriceAt(HALF_INCH, RUNGS, 1), 500);
  assert.equal(unitPriceAt(HALF_INCH, RUNGS, 4), 500);
});

test("reaching a rung reprices every unit, not just the extra ones", () => {
  // Five rolls is ₱2,250, not four at ₱500 plus one at ₱450.
  assert.equal(unitPriceAt(HALF_INCH, RUNGS, 5), 450);
  assert.equal(lineTotal(HALF_INCH, RUNGS, 5), 2250);
  assert.equal(lineTotal(HALF_INCH, RUNGS, 10), 4000);
});

test("the ladder does not care what order the rows arrive in", () => {
  const shuffled: PriceBreak[] = [
    { minQty: 10, unitPrice: 400 },
    { minQty: 5, unitPrice: 450 },
  ];
  assert.equal(unitPriceAt(HALF_INCH, shuffled, 7), 450);
  assert.deepEqual(ladder(shuffled).map((r) => r.minQty), [5, 10]);
});

test("a product with no ladder is simply its price", () => {
  assert.equal(unitPriceAt(200, [], 1), 200);
  assert.equal(lineTotal(200, [], 3), 600);
});

test("nonsense rows are ignored rather than trusted", () => {
  const junk = [
    { minQty: 0, unitPrice: 1 },
    { minQty: -5, unitPrice: 1 },
    { minQty: 5, unitPrice: Number.NaN },
    { minQty: 5, unitPrice: 450 },
  ];
  assert.deepEqual(ladder(junk), [{ minQty: 5, unitPrice: 450 }]);
  assert.equal(unitPriceAt(HALF_INCH, junk, 6), 450);
});

test("a quantity of zero costs nothing, not a negative", () => {
  assert.equal(lineTotal(HALF_INCH, RUNGS, 0), 0);
  assert.equal(lineTotal(HALF_INCH, RUNGS, -3), 0);
});

test("the next rung is worth naming, and what it saves is honest", () => {
  // At four rolls: one more and all five are ₱450. Five at ₱500 is ₱2,500,
  // five at ₱450 is ₱2,250 — ₱250 off the larger order, which is the
  // comparison a customer can act on. They have to buy the fifth roll.
  const s = nextSaving(HALF_INCH, RUNGS, 4);
  assert.deepEqual(s, { atQty: 5, unitPrice: 450, savesTotal: 250 });
});

test("nothing is promised once the best rung is reached", () => {
  assert.equal(nextSaving(HALF_INCH, RUNGS, 10), null);
  assert.equal(nextSaving(HALF_INCH, RUNGS, 40), null);
});

test("a rung that is not actually cheaper is not sold as a saving", () => {
  const flat: PriceBreak[] = [{ minQty: 5, unitPrice: 500 }];
  assert.equal(nextSaving(500, flat, 2), null);
});

test("the ladder reads as ranges, because a threshold leaves you working", () => {
  assert.deepEqual(ladderRows(HALF_INCH, RUNGS), [
    { from: 1, to: 4, unitPrice: 500 },
    { from: 5, to: 9, unitPrice: 450 },
    { from: 10, to: null, unitPrice: 400 },
  ]);
});

test("a ladder starting at one replaces the product's price entirely", () => {
  const fromOne: PriceBreak[] = [
    { minQty: 1, unitPrice: 4 },
    { minQty: 100, unitPrice: 3.8 },
  ];
  // The card price list: ₱4 each, ₱380 per hundred.
  assert.deepEqual(ladderRows(999, fromOne), [
    { from: 1, to: 99, unitPrice: 4 },
    { from: 100, to: null, unitPrice: 3.8 },
  ]);
  assert.equal(lineTotal(999, fromOne, 100), 380);
});

test("a product with no ladder still prints one row", () => {
  assert.deepEqual(ladderRows(149, []), [{ from: 1, to: null, unitPrice: 149 }]);
});
