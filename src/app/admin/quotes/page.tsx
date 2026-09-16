import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOperating, capacityRange } from "@/lib/operating-server";
import { loadCostBook } from "@/lib/costing-server";
import { QuoteDesk, type Preset } from "@/components/quote-desk";
import { hqTitle } from "@/lib/hq-theme";
import { addDays, shopToday } from "@/lib/format";
import { brand } from "../../../../config/index.ts";

/**
 * Pricing a custom job.
 *
 * The one screen this system has that the one it grew from did not. A shop
 * selling from a catalogue never needs it; a shop that makes to order needs
 * it before it needs anything else, because until there is a price there is
 * no order to track.
 *
 * Far enough ahead that a graduation in two months can be quoted, which is the
 * lead time this trade actually works to.
 */
const DAYS_AHEAD = 90;

export default async function AdminQuotesPage() {
  const viewer = await getViewer();
  if (!can(viewer, "orders")) {
    return (
      <NotAllowed>
        Quoting sets what a customer pays, so it sits with whoever takes
        orders. Send the enquiry their way and they can price it.
      </NotAllowed>
    );
  }

  const today = shopToday();
  const supabase = await createClient();

  // The cost book needs the costing capability; without it the presets carry
  // times but no material costs, which the desk renders as "not costed"
  // rather than as free.
  const costed = can(viewer, "costs");

  const [operating, days, products, book] = await Promise.all([
    getOperating(),
    capacityRange(today, addDays(today, DAYS_AHEAD)),
    supabase
      .from("products")
      .select("id, name, assembly_minutes")
      .eq("is_available", true)
      .order("name"),
    costed ? loadCostBook() : Promise.resolve(null),
  ]);

  const presets: Preset[] = (products.data ?? []).map((p) => {
    const cost = book?.mealCosts.get(String(p.id));
    return {
      id: String(p.id),
      name: String(p.name),
      minutes: Number(p.assembly_minutes) || 0,
      materials: cost?.costed ? cost.cost : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>Quote</h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/70">
          Work out what to charge for something that isn&apos;t in the{" "}
          {brand.copy.catalogue.toLowerCase()} yet. The cost, the date and the
          margin all move together, so you can answer while they&apos;re still
          asking.
        </p>
      </div>

      <QuoteDesk
        operating={operating}
        days={days}
        presets={presets}
        today={today}
      />
    </div>
  );
}
