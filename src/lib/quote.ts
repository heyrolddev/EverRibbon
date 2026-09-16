/**
 * What to charge for something nobody has made before.
 *
 * A shop that sells from a catalogue answers "how much?" by looking it up. A
 * shop that makes to order has to work it out every time, usually on a phone,
 * usually while the customer waits — and that is exactly when a number gets
 * invented. The shop this one is built for had done it by hand for a year, and
 * the spreadsheet showed what hand-pricing does: the same margin ranged from
 * 42.9% to 62% across six products with no reason recorded for any of it, and
 * the one selling best was the one priced worst.
 *
 * So this module does the arithmetic in one place, in both directions:
 *
 *   price it for me   a target margin, and the price that reaches it
 *   I'll set price    a price the owner types, and the margin it leaves
 *
 * Both run over the same cost build-up, so the two can never disagree.
 *
 * Pure over plain numbers — no database, no formatting, no rounding to a
 * currency until the very end. The screen, a printed quote and a test all get
 * the same figures.
 */

import { brand } from "../../config/index.ts";
import type { Operating } from "./operating.ts";

/**
 * Margin and markup are not the same number and the difference is a third of
 * the price.
 *
 * On ₱100 of cost, 50% margin is ₱200 and 50% markup is ₱150. Owners say
 * "fifty percent" meaning either, so the quote records which one was meant
 * rather than guessing — and the screen shows the other alongside it, because
 * seeing both is what stops the mistake being made twice.
 */
export type Uplift = "margin" | "markup";

export type QuoteLine = {
  /** What this is, in the words the customer used. */
  label: string;
  qty: number;
  /** Assembly minutes for ONE of these. */
  minutesEach: number;
  /** Cost of the materials in ONE of these. */
  materialsEach: number;
  /**
   * What to charge for one, or `null` to let the target uplift decide.
   *
   * A line may be priced by hand while its neighbours are priced from the
   * target: a customer who negotiated one item down has not renegotiated the
   * rest of the quote.
   */
  priceEach: number | null;
};

export type QuoteInput = {
  lines: QuoteLine[];
  /** The target, applied only to lines with no price of their own. */
  uplift: { kind: Uplift; percent: number };
  /** Added after the goods, and never marked up or rushed. */
  deliveryFee: number;
  /** Taken off the total. A positive number. */
  discount: number;
  /**
   * The surcharge for a date inside the rush window, as a percentage.
   *
   * Comes from `verdictFor` rather than being typed here, so a rush fee can
   * only appear on a quote the calendar actually said was rushed.
   */
  rushFeePercent: number;
  op: Operating;
};

export type PricedLine = QuoteLine & {
  /** True when the price came from the target rather than from a person. */
  derived: boolean;
  minutes: number;
  materials: number;
  labour: number;
  consumables: number;
  cost: number;
  price: number;
};

export type QuoteResult = {
  lines: PricedLine[];
  /** Total assembly minutes. What the capacity calendar books. */
  minutes: number;
  cost: {
    materials: number;
    labour: number;
    /** Per-unit consumables plus the one per-order charge. */
    consumables: number;
    total: number;
  };
  goods: number;
  rushFee: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deposit: number;
  balance: number;
  profit: number;
  /** Of the total, including delivery — the number the owner banks. */
  marginPercent: number;
  /** The same profit over cost, so the two readings sit side by side. */
  markupPercent: number;
  /**
   * What this quote is not telling you.
   *
   * A quote with no labour rate set and no materials entered computes a 100%
   * margin and looks like the best deal the shop ever struck. That is the
   * failure this list exists to put on the screen.
   */
  warnings: string[];
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * To the smallest unit the currency actually has.
 *
 * Used for the two figures that are amounts of money someone hands over — the
 * deposit and the balance — and for nothing else. Everything up to that point
 * stays at full precision, because rounding a subtotal and then rounding the
 * total built from it is how a column stops adding up.
 */
const cash = (n: number) => {
  const f = 10 ** brand.currency.decimals;
  return Math.round(n * f) / f;
};

/**
 * Price that reaches a target, from a cost.
 *
 * Margin divides, markup multiplies. A margin of 100% or more has no price
 * that satisfies it — the profit would have to be the whole of a price that
 * also has to cover the cost — so it is clamped just below and flagged rather
 * than returning an infinity that renders as "₱∞".
 */
export function priceFor(cost: number, uplift: Uplift, percent: number): number {
  const p = Math.max(0, percent);
  if (uplift === "markup") return cost * (1 + p / 100);
  if (p >= 100) return cost * 100; // clamped; the caller warns
  return cost / (1 - p / 100);
}

/**
 * Price a quote.
 *
 * The order of operations is the part worth stating, because every one of
 * these is somewhere a peso goes missing:
 *
 *   1. Each line costs materials + labour + per-unit consumables.
 *   2. The per-order consumables charge is counted once for the whole quote,
 *      not once per line — a bigger order does not use more tape than it
 *      needs because it has more lines in it. But it is then shared across
 *      the lines by unit before pricing, because otherwise a shop asking for
 *      60% gets 49.6%: an overhead that sits in the cost and in no price is
 *      an overhead the customer never pays for.
 *   3. Unpriced lines take the target uplift, on their own cost plus that
 *      share. Priced lines are left exactly as typed.
 *   4. The rush fee applies to the goods and not to delivery: the rider is
 *      not working any faster.
 *   5. Delivery is added whole, then the discount comes off the total.
 *   6. The deposit is a percentage of what the customer actually owes.
 */
export function quote(input: QuoteInput): QuoteResult {
  const { op } = input;
  const warnings: string[] = [];
  const perMinute = pos(op.labourRatePerHour) / 60;

  // Nothing quoted is not an order, so it does not carry an order's overhead.
  // Charging it would read as a quote that sells at a loss before anyone has
  // asked for anything.
  const perOrder = input.lines.length > 0 ? pos(op.consumablesPerOrder) : 0;
  const units = input.lines.reduce((t, l) => t + pos(l.qty), 0);

  const lines: PricedLine[] = input.lines.map((l) => {
    const qty = pos(l.qty);
    const minutes = pos(l.minutesEach) * qty;
    const materials = pos(l.materialsEach) * qty;
    const labour = minutes * perMinute;
    const consumables = pos(op.consumablesPerUnit) * qty;
    const cost = materials + labour + consumables;
    // This line's share of the one-per-order charge, by unit — or evenly when
    // the quote has lines but no quantities yet, so a half-filled form still
    // shows a number rather than a NaN.
    const share =
      units > 0 ? perOrder * (qty / units) : perOrder / input.lines.length;
    const derived = l.priceEach === null;
    const price = derived
      ? priceFor(cost + share, input.uplift.kind, input.uplift.percent)
      : pos(l.priceEach ?? 0) * qty;
    return { ...l, derived, minutes, materials, labour, consumables, cost, price };
  });

  const sum = (pick: (l: PricedLine) => number) =>
    lines.reduce((t, l) => t + pick(l), 0);
  const cost = {
    materials: sum((l) => l.materials),
    labour: sum((l) => l.labour),
    consumables: sum((l) => l.consumables) + perOrder,
    total: sum((l) => l.cost) + perOrder,
  };

  const goods = sum((l) => l.price);
  const rushFee = goods * (pos(input.rushFeePercent) / 100);
  const deliveryFee = pos(input.deliveryFee);
  const discount = Math.min(pos(input.discount), goods + rushFee + deliveryFee);
  const total = goods + rushFee + deliveryFee - discount;

  // Rounded to the centavo, and the balance is whatever is left of the total
  // after it. Rounding both independently made them sum to a centavo more
  // than the total — small, and exactly the kind of thing a customer notices
  // on the one document where the shop is asking to be trusted with money.
  const deposit = op.depositEnabled ? cash(total * (pos(op.depositPercent) / 100)) : 0;
  const profit = total - cost.total;

  // Over the price when read as margin, over the cost when read as markup.
  // Both are undefined on a zero denominator, and zero is the honest answer
  // there rather than a percentage of nothing.
  const marginPercent = total > 0 ? (profit / total) * 100 : 0;
  const markupPercent = cost.total > 0 ? (profit / cost.total) * 100 : 0;

  if (lines.length === 0) warnings.push("Nothing on this quote yet.");
  if (perMinute === 0 && sum((l) => l.minutes) > 0)
    warnings.push(
      "Labour is not costed — set an hourly rate in Settings, or this quote is charging nothing for the work."
    );
  if (cost.materials === 0 && lines.length > 0)
    warnings.push("No material cost entered, so every peso here reads as profit.");
  if (input.uplift.kind === "margin" && input.uplift.percent >= 100)
    warnings.push("A margin of 100% or more has no price that reaches it.");
  if (profit < 0) warnings.push("This quote sells at a loss.");
  for (const l of lines)
    if (l.qty > 0 && l.minutesEach === 0)
      warnings.push(`"${l.label || "Untitled line"}" is costed at no time to make.`);

  return {
    lines,
    minutes: sum((l) => l.minutes),
    cost,
    goods,
    rushFee,
    deliveryFee,
    discount,
    total,
    deposit,
    balance: cash(total) - deposit,
    profit,
    marginPercent,
    markupPercent,
    warnings,
  };
}

/**
 * The margin a price would leave, before committing to it.
 *
 * For the other direction of the calculator: the owner types a round number
 * the customer will find easy to hear, and sees what it does to the quote
 * without having to save it first.
 */
export function marginAt(price: number, cost: number): { margin: number; markup: number } {
  const profit = price - cost;
  return {
    margin: price > 0 ? (profit / price) * 100 : 0,
    markup: cost > 0 ? (profit / cost) * 100 : 0,
  };
}

/**
 * How many days a quote should stand.
 *
 * Ribbon is bought by the roll at a price that moves, and a quote with no end
 * on it is a promise to honour last month's cost. Two weeks is long enough to
 * decide on a graduation and short enough that stock has not turned over.
 */
export const QUOTE_VALID_DAYS = 14;
