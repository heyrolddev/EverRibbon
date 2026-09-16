import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOperating, capacityRange } from "@/lib/operating";
import { CapacityView } from "@/components/capacity-view";
import { hqTitle } from "@/lib/hq-theme";
import { addDays, shopToday } from "@/lib/format";

/** A fortnight: far enough to plan, near enough that the numbers mean something. */
const DAYS_AHEAD = 13;

export default async function AdminCapacityPage() {
  const viewer = await getViewer();
  // Hidden from the sidebar too, but hiding a link is not a permission —
  // a bookmark reaches this page all the same.
  if (!can(viewer, "settings")) {
    return (
      <NotAllowed>
        How the shop&apos;s days are costed is set by the owner. If a date looks
        wrong on the calendar, tell them — it changes what customers can book.
      </NotAllowed>
    );
  }

  const from = shopToday();
  const to = addDays(from, DAYS_AHEAD);

  const supabase = await createClient();
  const [operating, days, products] = await Promise.all([
    getOperating(),
    capacityRange(from, to),
    supabase.from("products").select("id, assembly_minutes").eq("is_available", true),
  ]);

  const rows = products.data ?? [];
  const costedProducts = {
    timed: rows.filter((p) => Number(p.assembly_minutes) > 0).length,
    total: rows.length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>Capacity</h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/70">
          What the shop can still take, and the numbers that decide it. A day
          fills with minutes of work, not with a count of orders.
        </p>
      </div>

      <CapacityView days={days} operating={operating} costedProducts={costedProducts} />
    </div>
  );
}
