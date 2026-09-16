import test from "node:test";
import assert from "node:assert/strict";
import { lineName, tallyName, CUSTOM_WORK } from "../src/lib/order-lines.ts";

/**
 * The bug this guards against shipped for exactly one day: every screen read
 * `products?.name ?? "Item"`, and the migration that let a line exist without
 * a product turned every bespoke bouquet on the order board into "2 × Item".
 */

test("a catalogue line reads as its product", () => {
  assert.equal(lineName({ products: { name: "3-stem bouquet" } }), "3-stem bouquet");
});

test("a custom line reads as what the customer asked for", () => {
  assert.equal(
    lineName({ label: "12-stem, maroon + gold", products: null }),
    "12-stem, maroon + gold"
  );
});

test("the product wins when a line somehow has both", () => {
  // A renamed product should read as its new name, not as the words typed
  // into a quote months ago.
  assert.equal(
    lineName({ label: "old wording", products: { name: "New name" } }),
    "New name"
  );
});

test("whitespace is not a name", () => {
  assert.equal(lineName({ label: "   ", products: { name: "  " } }), "Item");
  assert.equal(lineName({ label: "   ", products: null }, "Something"), "Something");
});

test("a line with neither still renders rather than breaking the row", () => {
  assert.equal(lineName({}), "Item");
});

test("custom jobs tally together, not one row each", () => {
  // Four hundred one-off bouquets in a best-sellers list is four hundred rows
  // with a quantity of one, and no best seller.
  assert.equal(tallyName({ label: "12-stem, maroon", products: null }), CUSTOM_WORK);
  assert.equal(tallyName({ label: "3-stem, ivory", products: null }), CUSTOM_WORK);
  assert.equal(tallyName({ products: { name: "3-stem bouquet" } }), "3-stem bouquet");
});
