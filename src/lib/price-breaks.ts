/**
 * What one costs when you buy several.
 *
 * An "all units" ladder, not a marginal one: at ten rolls all ten are ₱400,
 * because that is how the shop's own price list reads and how a customer
 * expects it to work. Marginal tiers — four at ₱500 then six at ₱400 — are a
 * different product and would need saying out loud on the page.
 *
 * Pure over plain numbers so the menu, the quote desk and a printed price
 * list can never disagree about what something costs.
 */

export type PriceBreak = {
  /** Buy this many and every one of them is `unitPrice`. */
  minQty: number;
  unitPrice: number;
};

/** Sorted, cleaned, and safe to walk. Rows arrive in whatever order they like. */
export function ladder(breaks: PriceBreak[]): PriceBreak[] {
  return breaks
    .filter((b) => Number.isFinite(b.minQty) && b.minQty > 0)
    .filter((b) => Number.isFinite(b.unitPrice) && b.unitPrice >= 0)
    .sort((a, b) => a.minQty - b.minQty);
}

/**
 * The unit price at a given quantity.
 *
 * `base` is the product's own price and is what applies below the first rung.
 * A ladder that starts at 1 therefore overrides it entirely, which is the
 * shape most price lists actually have.
 */
export function unitPriceAt(
  base: number,
  breaks: PriceBreak[],
  qty: number
): number {
  const rungs = ladder(breaks);
  let price = base;
  for (const rung of rungs) {
    if (qty >= rung.minQty) price = rung.unitPrice;
    else break;
  }
  return price;
}

/** What the whole lot comes to. */
export const lineTotal = (base: number, breaks: PriceBreak[], qty: number) =>
  unitPriceAt(base, breaks, qty) * Math.max(0, qty);

/**
 * The next rung, and what reaching it would save.
 *
 * The one genuinely useful thing to say on a product page: "two more rolls
 * and every roll is ₱50 cheaper" sells the extra two rolls. `null` when the
 * customer is already on the best rung, so nothing is said rather than
 * something hollow.
 */
export function nextSaving(
  base: number,
  breaks: PriceBreak[],
  qty: number
): { atQty: number; unitPrice: number; savesTotal: number } | null {
  const rungs = ladder(breaks);
  const next = rungs.find((r) => r.minQty > qty);
  if (!next) return null;

  const now = unitPriceAt(base, breaks, qty);
  // Nothing to say when the next rung is not actually cheaper.
  if (!(next.unitPrice < now)) return null;

  return {
    atQty: next.minQty,
    unitPrice: next.unitPrice,
    // What they would pay for the larger order against what that many would
    // cost at today's rate — the honest comparison, since they have to buy
    // more to get there.
    savesTotal: next.minQty * now - next.minQty * next.unitPrice,
  };
}

/**
 * The ladder as a customer reads it: "1–4 · 5–9 · 10+".
 *
 * Ranges rather than thresholds, because "5" on its own leaves the reader
 * working out where it stops.
 */
export function ladderRows(
  base: number,
  breaks: PriceBreak[]
): { from: number; to: number | null; unitPrice: number }[] {
  const rungs = ladder(breaks);
  if (rungs.length === 0) return [{ from: 1, to: null, unitPrice: base }];

  const rows: { from: number; to: number | null; unitPrice: number }[] = [];
  // The stretch below the first rung, when there is one.
  const first = rungs[0];
  if (first && first.minQty > 1) {
    rows.push({ from: 1, to: first.minQty - 1, unitPrice: base });
  }
  rungs.forEach((rung, i) => {
    const next = rungs[i + 1];
    rows.push({
      from: rung.minQty,
      to: next ? next.minQty - 1 : null,
      unitPrice: rung.unitPrice,
    });
  });
  return rows;
}
