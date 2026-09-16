/**
 * The steps an order goes through, as data.
 *
 * These were a constant array and a CHECK constraint, which meant a shop whose
 * work is shaped differently needed a migration and a deploy to add one step.
 * They are rows now (see migration 0007), so everything here takes the list as
 * an argument rather than importing it: a pure module that cannot go stale,
 * and a server module beside it that knows how to fetch.
 *
 * `OrderStatus` is a plain string for the same reason. It was a union of seven
 * literals, which is exactly the compile-time guarantee a runtime list cannot
 * give — and pretending otherwise would put the check in the one place that
 * can no longer honour it.
 */

/** The ramps a status may take. Names, never colours — see globals.css. */
export const STATUS_TONES = ["brand", "accent", "ink", "ok", "warn", "bad"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export type OrderStatus = string;

export type OrderStatusRow = {
  key: OrderStatus;
  label: string;
  sortOrder: number;
  /** The shop still owes this customer something. */
  isOpen: boolean;
  /** Nothing proceeds past this without a person acting. */
  isGate: boolean;
  /** "On the way" is nonsense for a pick-up. */
  deliveryOnly: boolean;
  /**
   * From this step on, the order's materials are spoken for.
   *
   * Asked of the data rather than assumed from a status name, because the
   * names differ per shop and the consequence of guessing is stock counts
   * that read high until the day they matter.
   */
  commitsStock: boolean;
  tone: StatusTone;
  hint: string | null;
};

/**
 * What a shop gets before anyone has touched the statuses screen.
 *
 * Present so a database that has not run migration 0007 renders a working
 * board instead of an empty one. It is a floor, not a default: the moment the
 * table has rows, they win.
 */
export const FALLBACK_STATUSES: OrderStatusRow[] = [
  { key: "pending",          label: "Pending",    sortOrder: 10, isOpen: true,  isGate: true,  deliveryOnly: false, commitsStock: false, tone: "accent", hint: "New in. Nobody has accepted these yet." },
  { key: "confirmed",        label: "Confirmed",  sortOrder: 20, isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true, tone: "warn",   hint: "Accepted, not started." },
  { key: "preparing",        label: "Preparing",  sortOrder: 30, isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true, tone: "brand",  hint: "Being made now." },
  { key: "ready",            label: "Ready",      sortOrder: 40, isOpen: true,  isGate: false, deliveryOnly: false, commitsStock: true, tone: "ok",     hint: "Waiting for the customer." },
  { key: "out_for_delivery", label: "On the way", sortOrder: 50, isOpen: true,  isGate: false, deliveryOnly: true,  commitsStock: true, tone: "ink",    hint: "Left the shop." },
  { key: "completed",        label: "Completed",  sortOrder: 60, isOpen: false, isGate: false, deliveryOnly: false, commitsStock: true, tone: "ink",    hint: "Done and handed over." },
  { key: "cancelled",        label: "Cancelled",  sortOrder: 70, isOpen: false, isGate: false, deliveryOnly: false, commitsStock: false, tone: "bad",    hint: "Did not happen." },
];

/** Every key, in the order the shop works through them. */
export const keysOf = (rows: OrderStatusRow[]): OrderStatus[] =>
  [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.key);

/**
 * The ones where the shop still owes someone something.
 *
 * This used to be a second hand-written array, which meant adding a step
 * involved remembering to add it here too — and four separate files each
 * listed the same five names. Now it is a question asked of the data.
 */
export const openKeys = (rows: OrderStatusRow[]): OrderStatus[] =>
  keysOf(rows.filter((r) => r.isOpen));

/** The ones nothing proceeds past without a person acting. */
export const gateKeys = (rows: OrderStatusRow[]): OrderStatus[] =>
  keysOf(rows.filter((r) => r.isGate));

/** The steps from which an order's materials are off the shelf. */
export const committedKeys = (rows: OrderStatusRow[]): OrderStatus[] =>
  keysOf(rows.filter((r) => r.commitsStock));

export const findStatus = (rows: OrderStatusRow[], key: OrderStatus) =>
  rows.find((r) => r.key === key);

/** The label, falling back to the key so a screen never renders blank. */
export const labelOf = (rows: OrderStatusRow[], key: OrderStatus): string =>
  findStatus(rows, key)?.label ?? key;

export const toneOf = (rows: OrderStatusRow[], key: OrderStatus): StatusTone =>
  findStatus(rows, key)?.tone ?? "ink";

export const isOpen = (rows: OrderStatusRow[], key: OrderStatus): boolean =>
  findStatus(rows, key)?.isOpen ?? false;

export const isGate = (rows: OrderStatusRow[], key: OrderStatus): boolean =>
  findStatus(rows, key)?.isGate ?? false;

/**
 * The steps this order can actually reach.
 *
 * A pick-up never goes out for delivery, so offering staff a step they can
 * never legitimately use is worse than not offering it: somebody eventually
 * presses it, and the customer is told their order is on the way to an address
 * nobody has.
 */
export const statusesFor = (rows: OrderStatusRow[], fulfillment: string): OrderStatusRow[] =>
  [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((r) => !r.deliveryOnly || fulfillment === "delivery");

/**
 * Tailwind classes for a tone, in the three shapes a status is drawn in.
 *
 * Built from the ramp name rather than stored, so a shop that adds a step
 * chooses from six words instead of writing class strings into a database --
 * which is how a colour ends up somewhere the theme cannot reach it.
 */
export function toneClasses(tone: StatusTone) {
  const chip: Record<StatusTone, string> = {
    brand: "bg-brand-700 text-paper-50",
    accent: "bg-accent-200 text-ink-950",
    ink: "bg-ink-800 text-paper-50",
    ok: "bg-ok-700 text-paper-50",
    warn: "bg-warn-700 text-paper-50",
    bad: "bg-bad-700 text-paper-50",
  };
  const dot: Record<StatusTone, string> = {
    brand: "bg-brand-700", accent: "bg-accent-200", ink: "bg-ink-800",
    ok: "bg-ok-700", warn: "bg-warn-700", bad: "bg-bad-700",
  };
  const rail: Record<StatusTone, string> = {
    brand: "border-brand-700", accent: "border-accent-200", ink: "border-ink-800",
    ok: "border-ok-700", warn: "border-warn-700", bad: "border-bad-700",
  };
  return { chip: chip[tone], dot: dot[tone], rail: rail[tone] };
}
