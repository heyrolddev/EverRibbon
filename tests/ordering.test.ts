import test from "node:test";
import assert from "node:assert/strict";
import { ASK_PATH, askHref, productActionLabel, quoteFirst, takesCart } from "../src/lib/ordering.ts";

test("a shop that makes to order has no cart", () => {
  /*
   * The bug this closes: both doors were open at once. A customer could put
   * a "Graduation Sash" in a cart and pay for it without anybody ever asking
   * whose name goes on it — an order the shop cannot start, taken at a
   * checkout that looked like it worked.
   */
  assert.equal(takesCart("made_to_order"), false);
  assert.equal(quoteFirst("made_to_order"), true);
});

test("a shop selling off the shelf keeps its cart", () => {
  // The template serves both. Removing the cart outright would break every
  // shop that sells a thing that already exists.
  assert.equal(takesCart("immediate"), true);
  assert.equal(quoteFirst("immediate"), false);
});

test("an unknown mode is treated as made-to-order, not as a cart", () => {
  // The safe side of this fence: offering a conversation to somebody who
  // could have paid costs a click, and taking money for something nobody
  // described costs a refund and a customer.
  assert.equal(takesCart("something-new"), false);
  assert.equal(takesCart(""), false);
});

test("asking about a product carries the product", () => {
  // The difference between "tell us what you'd like" and a blank box
  // somebody has to describe their way out of.
  assert.equal(askHref("prod_1"), `${ASK_PATH}?product=prod_1`);
  assert.equal(askHref(), ASK_PATH);
  assert.equal(askHref("  "), ASK_PATH);
  assert.equal(askHref(null), ASK_PATH);
});

test("an id with characters that mean something in a URL still arrives", () => {
  assert.equal(askHref("a b&c=d"), `${ASK_PATH}?product=a%20b%26c%3Dd`);
});

test("the button says what actually happens next", () => {
  assert.equal(productActionLabel("immediate"), "Add");
  assert.equal(productActionLabel("made_to_order"), "Ask for a price");
});
