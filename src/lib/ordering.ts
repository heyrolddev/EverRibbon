import { brand } from "../../config/index.ts";

/**
 * How a customer places an order here — and there is only ever one way.
 *
 * Two kinds of shop use this template and they want opposite things.
 *
 * A shop that sells what is already on the shelf wants a cart: tap, tap,
 * pay, done. Nothing needs deciding because the thing already exists.
 *
 * A shop that makes to order cannot take money at a checkout, because at the
 * checkout nobody has said what to print. This one had both paths live at
 * once — a cart that would sell a "Graduation Sash" without ever asking
 * whose name goes on it, next to an enquiry form that asks properly. Two
 * doors to the same shop, one of them leading somewhere the shop cannot
 * actually deliver from.
 *
 * So the mode decides, in one place, and every screen asks here rather than
 * guessing. A customer sees one door.
 */

/** Can somebody buy straight off the list, at the price on it? */
export const takesCart = (
  fulfillment: string = brand.fulfillment
): boolean => fulfillment === "immediate";

/** Everything is priced per job, so the first step is a conversation. */
export const quoteFirst = (fulfillment: string = brand.fulfillment): boolean =>
  !takesCart(fulfillment);

/** Where "I want this" leads. */
export const ASK_PATH = "/enquire";

/**
 * The link from a product to asking about it.
 *
 * Carrying the product means the form opens already knowing what they
 * tapped, which is the difference between "tell us what you'd like" and a
 * blank box somebody has to describe their way out of.
 */
export function askHref(productId?: string | null): string {
  const id = (productId ?? "").trim();
  return id ? `${ASK_PATH}?product=${encodeURIComponent(id)}` : ASK_PATH;
}

/**
 * What the button on a product says.
 *
 * "Add to cart" on something that does not exist yet is a promise the shop
 * cannot keep, and the word people actually use for this is "magkano".
 */
export const productActionLabel = (fulfillment: string = brand.fulfillment) =>
  takesCart(fulfillment) ? "Add" : "Ask for a price";
