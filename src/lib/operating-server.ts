/**
 * Reading the operating numbers, and the calendar, out of the database.
 *
 * The shapes and the arithmetic are in `operating.ts`; this is only the part
 * that needs a connection. Keeping them apart is what lets the quote maths be
 * tested as plain functions.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  OPERATING_DEFAULTS,
  type CapacityDay,
  type Operating,
} from "./operating.ts";

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
