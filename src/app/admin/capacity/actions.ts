"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";

const NOT_YOURS = "Only the owner can change how the shop's days are costed.";

/**
 * Save the numbers the whole costing and calendar rest on.
 *
 * Every one is clamped rather than trusted. These come from a form, and a
 * capacity of 4,000 minutes or a rate of minus fifty does not fail loudly — it
 * quietly makes every price on every screen wrong, which is a far worse way to
 * find out.
 */
export async function saveOperating(input: {
  capacityMinutesPerDay: number;
  labourRatePerHour: number;
  consumablesPerUnit: number;
  consumablesPerOrder: number;
  depositCoolingOffMinutes: number;
  rushWindowDays: number;
  rushFeePercent: number;
}): Promise<{ error: string | null }> {
  const viewer = await getViewer();
  if (!can(viewer, "settings")) return { error: NOT_YOURS };

  const whole = (n: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  const money = (n: number, hi: number) =>
    Math.max(0, Math.min(hi, Math.round((Number(n) || 0) * 100) / 100));

  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_settings")
    .update({
      // A day has 1,440 minutes; anything above it is a typo, not ambition.
      capacity_minutes_per_day: whole(input.capacityMinutesPerDay, 0, 1440),
      labour_rate_per_hour: money(input.labourRatePerHour, 100000),
      consumables_per_unit: money(input.consumablesPerUnit, 100000),
      consumables_per_order: money(input.consumablesPerOrder, 100000),
      // A week is already a long time to hold someone's money reversibly.
      deposit_cooling_off_minutes: whole(input.depositCoolingOffMinutes, 0, 10080),
      rush_window_days: whole(input.rushWindowDays, 0, 90),
      rush_fee_percent: money(input.rushFeePercent, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return {
      error: `${error.message}. If this mentions a column, run migration 0008 in the Supabase SQL Editor.`,
    };
  }

  revalidatePath("/admin/capacity");
  return { error: null };
}
