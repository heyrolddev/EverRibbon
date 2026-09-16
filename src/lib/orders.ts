/**
 * What an order is, apart from which step it is on.
 *
 * The steps themselves moved to src/lib/order-statuses.ts and to the database
 * behind it. What is left here is the part that does not vary by shop: how an
 * order is handed over, and what counts as a sane quantity.
 *
 * The status list used to live at the top of this file as a constant array,
 * with a second array naming which of them were "active" and a third mapping
 * each to its colours. Adding a step meant editing three places and hoping.
 */

import { brand } from "../../config/index.ts";
/**
 * How the order reaches the customer, in the shop's words.
 *
 * Unlike the steps, these three are structural: the code branches on them --
 * a delivery has a fee and an address, a dine-in has neither -- so they are
 * not something a shop redefines without the code knowing.
 */
const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: "Take-out",
  delivery: "Delivery",
  dine_in: "Dine in",
};

export function fulfillmentLabel(fulfillment: string): string {
  return FULFILLMENT_LABELS[fulfillment] ?? fulfillment;
}

/** Does this order leave in packaging? Dine-in is the only one that doesn't. */
export function isPacked(fulfillment: string): boolean {
  return fulfillment !== "dine_in";
}

/* ============================================================
 * How many of one product may go on one line
 *
 * This lives here, shared, because of how it went wrong.
 *
 * `updateMyOrder` checked the quantity. `placeOrder` — the one action the
 * public can reach — did not, and the browser's number went straight into the
 * books. Checkout verified the price against the database, recomputed the
 * delivery fee, tested stock, the phone number, the opening hours and whether
 * the account was blocked. Every number the browser sent was distrusted
 * except this one.
 *
 * Sending a negative quantity produced a negative subtotal, slipped past the
 * stock test (`5 < -10` is false, so nothing looked short) and wrote a
 * negative sale that the takings, the profit figures, the analytics and the
 * stock movement all then read as real.
 *
 * Two copies of a rule is one copy and one bug waiting. So there is one copy,
 * and all three ways an order can be written now call it.
 * ============================================================ */

/**
 * Ninety-nine of one product.
 *
 * A ceiling rather than no ceiling, because a stall that gets an order for
 * four thousand servings has been probed, not patronised — and because the
 * kitchen would have to refuse it anyway.
 */
export const MAX_LINE_QTY = 99;

/**
 * What is wrong with this quantity, in words a customer can act on, or null.
 *
 * `allowZero` is for editing an order that already exists, where zero is the
 * customer removing a line rather than an invalid amount.
 */
export function quantityProblem(
  qty: unknown,
  { allowZero = false }: { allowZero?: boolean } = {}
): string | null {
  if (typeof qty !== "number" || !Number.isFinite(qty)) {
    return "Something went wrong with the amounts in your cart. Please reload and try again.";
  }
  if (!Number.isInteger(qty)) {
    return "We can only cook whole servings — please use a round number.";
  }
  if (qty < (allowZero ? 0 : 1)) {
    return "Please choose at least one of each item.";
  }
  if (qty > MAX_LINE_QTY) {
    return `That's more than ${MAX_LINE_QTY} of one product — please ring us on ${brand.contact.phone} so we can prepare for a large order.`;
  }
  return null;
}

/** The first thing wrong anywhere in a cart, or null if it is all fine. */
export function cartQuantityProblem(
  items: { qty: unknown }[],
  options?: { allowZero?: boolean }
): string | null {
  for (const item of items) {
    const problem = quantityProblem(item.qty, options);
    if (problem) return problem;
  }
  return null;
}
