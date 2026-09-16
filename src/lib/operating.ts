/**
 * The numbers a shop owner changes, and the line between them and the config.
 *
 * Two kinds of setting look alike and are not:
 *
 *   config/brands/<shop>.ts   what the shop IS. Name, palette, fonts, locale,
 *                             timezone, currency, and whether it hands over
 *                             now or builds first. Changing any of these is a
 *                             deploy, and should be.
 *
 *   this module               how the shop WORKS today. The rate, the ceiling
 *                             on a day, what the deposit is, how long someone
 *                             has to change their mind. The owner edits these
 *                             on a Tuesday without telling anyone.
 *
 * Putting the second kind in the first is the mistake this module exists to
 * prevent -- and one had already been made: the deposit percentage sat in the
 * brand config while the real one had lived in payment_settings all along, so
 * the two could disagree and only one of them was reachable from the admin.
 *
 * Split in two: the types, the defaults and the arithmetic are here, with no
 * database in sight, so a test can price a quote without a Supabase client and
 * without `server-only` refusing to load. Everything that reads a row lives in
 * `operating-server.ts` beside it.
 */

export type Operating = {
  /** Minutes of work a single day can hold. The calendar's ceiling. */
  capacityMinutesPerDay: number;
  /** What an hour of the maker's time is worth. Zero means labour is uncosted. */
  labourRatePerHour: number;
  /** Glue, tape, the small things. They scale differently, so they are separate. */
  consumablesPerUnit: number;
  consumablesPerOrder: number;
  /**
   * How long after a deal is agreed the deposit stays refundable.
   *
   * Measured from the moment work starts, not counted back from the due date:
   * the irreversible act is cutting stock, not the calendar turning.
   */
  depositCoolingOffMinutes: number;
  /** A date inside this window is offered with a surcharge, never refused. */
  rushWindowDays: number;
  rushFeePercent: number;
  /** What the customer pays up front, as a percentage. From payment_settings. */
  depositPercent: number;
  depositEnabled: boolean;
};

/**
 * What a shop that has not touched the settings screen gets.
 *
 * Ten hours a day, and every money figure at zero. Zero is deliberate: a rate
 * nobody has set should read as "not costed" on the screen, rather than
 * quietly pricing a shop's work at a number this file invented.
 */
export const OPERATING_DEFAULTS: Operating = {
  capacityMinutesPerDay: 600,
  labourRatePerHour: 0,
  consumablesPerUnit: 0,
  consumablesPerOrder: 0,
  depositCoolingOffMinutes: 0,
  rushWindowDays: 0,
  rushFeePercent: 0,
  depositPercent: 0,
  depositEnabled: false,
};

export type CapacityDay = {
  /** ISO date, in the shop's own calendar. */
  day: string;
  booked: number;
  ceiling: number;
  free: number;
  /** Working that day, and nothing left. */
  isFull: boolean;
  /** Not working that day at all. */
  isClosed: boolean;
  orders: number;
};

/**
 * Whether a date can take this much more work, and what to say if not.
 *
 * Returns a surcharge rather than a refusal for a date inside the rush window:
 * a near date is a conversation, and a calendar that simply blocks it loses
 * the order to whoever will pick up the phone.
 */
export function verdictFor(
  day: CapacityDay | undefined,
  minutesWanted: number,
  op: Operating,
  daysAway: number
): { ok: boolean; reason?: string; rushFeePercent?: number } {
  if (!day) return { ok: false, reason: "That date is outside the calendar." };
  if (day.isClosed) return { ok: false, reason: "The shop is not working that day." };
  if (minutesWanted > day.free) {
    return {
      ok: false,
      reason:
        day.free <= 0
          ? "That day is fully booked."
          : `Only ${Math.floor(day.free)} minutes are left that day.`,
    };
  }
  if (op.rushWindowDays > 0 && daysAway <= op.rushWindowDays && op.rushFeePercent > 0) {
    return { ok: true, rushFeePercent: op.rushFeePercent };
  }
  return { ok: true };
}
