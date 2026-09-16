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
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";

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

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Read the shop's operating numbers.
 *
 * Falls back to the defaults rather than throwing when a row is missing, so a
 * half-migrated database shows a working screen with obvious zeroes instead of
 * an error page. The zeroes are the signal; a crash is not.
 */
export async function getOperating(): Promise<Operating> {
  const supabase = await createClient();

  const [shop, payment] = await Promise.all([
    supabase
      .from("shop_settings")
      .select(
        "capacity_minutes_per_day, labour_rate_per_hour, consumables_per_unit, " +
          "consumables_per_order, deposit_cooling_off_minutes, rush_window_days, rush_fee_percent"
      )
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("payment_settings")
      .select("downpayment_enabled, downpayment_percent")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  /*
   * The two rows, as the columns this module reads them. Typed here rather
   * than inferred because a missing row gives back null, and every field then
   * has to survive being absent -- which is the case the defaults exist for.
   */
  const s = (shop.data ?? {}) as Partial<Record<
    | "capacity_minutes_per_day" | "labour_rate_per_hour" | "consumables_per_unit"
    | "consumables_per_order" | "deposit_cooling_off_minutes"
    | "rush_window_days" | "rush_fee_percent",
    unknown
  >>;
  const p = (payment.data ?? {}) as Partial<Record<"downpayment_enabled" | "downpayment_percent", unknown>>;
  const d = OPERATING_DEFAULTS;

  return {
    capacityMinutesPerDay: num(s.capacity_minutes_per_day, d.capacityMinutesPerDay),
    labourRatePerHour: num(s.labour_rate_per_hour, d.labourRatePerHour),
    consumablesPerUnit: num(s.consumables_per_unit, d.consumablesPerUnit),
    consumablesPerOrder: num(s.consumables_per_order, d.consumablesPerOrder),
    depositCoolingOffMinutes: num(s.deposit_cooling_off_minutes, d.depositCoolingOffMinutes),
    rushWindowDays: num(s.rush_window_days, d.rushWindowDays),
    rushFeePercent: num(s.rush_fee_percent, d.rushFeePercent),
    depositPercent: num(p.downpayment_percent, d.depositPercent),
    depositEnabled: Boolean(p.downpayment_enabled),
  };
}

/**
 * Minutes already committed on a day, and what is left.
 *
 * The ceiling is hours, not a count of orders: a day holding one bouquet and a
 * day holding twenty printed ribbons are not the same day, and a calendar that
 * counts orders oversells the first and refuses the second.
 */
export async function capacityOn(day: string, op?: Operating) {
  const supabase = await createClient();
  const settings = op ?? (await getOperating());
  const { data } = await supabase.rpc("minutes_booked", { p_day: day });
  const booked = num(data, 0);
  const ceiling = settings.capacityMinutesPerDay;
  return {
    day,
    booked,
    ceiling,
    free: Math.max(0, ceiling - booked),
    full: booked >= ceiling,
  };
}

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
 * A stretch of days, and what is left in each.
 *
 * One query rather than one per day: a fortnight drawn by calling
 * `capacityOn` fourteen times is fourteen round trips to render one screen.
 *
 * Closed and full are kept apart deliberately. A rest day has no minutes and
 * no work, which arithmetic alone reads as "full" -- and a calendar that tells
 * an owner Sunday is full is telling them something untrue about a day they
 * chose not to work.
 */
export async function capacityRange(from: string, to: string): Promise<CapacityDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("capacity_calendar", { p_from: from, p_to: to });
  if (error || !Array.isArray(data)) return [];

  return data.map((r: Record<string, unknown>) => ({
    day: String(r.day),
    booked: num(r.booked, 0),
    ceiling: num(r.ceiling, 0),
    free: num(r.free, 0),
    isFull: Boolean(r.is_full),
    isClosed: Boolean(r.is_closed),
    orders: num(r.orders, 0),
  }));
}

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
