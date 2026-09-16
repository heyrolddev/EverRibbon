/**
 * What to call a line on an order.
 *
 * Since 0013 a line is either a catalogue product or a description of
 * something nobody has made before, and `product_id` is null for the second
 * kind. Every screen that had `products?.name ?? "Item"` in it was therefore
 * printing "2 × Item" for a bespoke bouquet — on the order board, on the
 * customer's own order page, and, worst, in the analytics tally, where every
 * custom job in the shop's history collapsed into one row called "Unknown
 * item".
 *
 * One function, so the next screen to show a line cannot get it wrong. The
 * fallback is last, not first: a product that has been renamed should read as
 * its new name, and only a line with neither gets the placeholder.
 */

export type NamedLine = {
  label?: string | null;
  products?: { name: string } | null;
};

/** The columns every caller has to select for `lineName` to work. */
export const LINE_NAME_COLUMNS = "label, products(name)";

export function lineName(line: NamedLine, fallback = "Item"): string {
  const product = line.products?.name?.trim();
  if (product) return product;
  const label = line.label?.trim();
  if (label) return label;
  return fallback;
}

/**
 * How a line should be counted in a sales tally.
 *
 * A custom line is not a product and never repeats: "12-stem graduation
 * bouquet, maroon + gold" is one job for one customer, and a best-sellers
 * list with four hundred of those in it has no best seller in it at all. So
 * they are counted together, under one heading that says what they are.
 *
 * The revenue is still theirs — a shop whose custom work outsells its
 * catalogue needs to see exactly that, and it is the reason this returns a
 * heading rather than dropping the row.
 */
export const CUSTOM_WORK = "Custom work";

export function tallyName(line: NamedLine): string {
  const product = line.products?.name?.trim();
  return product || CUSTOM_WORK;
}
