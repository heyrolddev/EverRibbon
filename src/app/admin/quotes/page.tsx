import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOperating, capacityRange } from "@/lib/operating-server";
import { loadCostBook } from "@/lib/costing-server";
import { QuoteDesk, type Existing, type Preset } from "@/components/quote-desk";
import { getSpecQuestions } from "@/lib/spec-server";
import { categoriesForAnswers, parseSpec, valuesOf } from "@/lib/spec";
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

export default async function AdminQuotesPage({
  searchParams,
}: {
  /** `?order=…` opens an enquiry already on the board instead of a blank desk. */
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: openOrderId } = await searchParams;
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

  const [operating, questions, days, products, ladders, book] = await Promise.all([
    getOperating(),
    // What this shop asks about a job. Empty on a shop that asks nothing,
    // and the desk renders nothing for it rather than an empty heading.
    getSpecQuestions(),
    capacityRange(today, addDays(today, DAYS_AHEAD)),
    supabase
      .from("products")
      .select("id, name, price, assembly_minutes, categories")
      .eq("is_available", true)
      .order("name"),
    // The shop's own volume ladders, so a quote for ten rolls is the price
    // the customer can already read on the catalogue page.
    supabase
      .from("product_price_breaks")
      .select("product_id, min_qty, unit_price")
      .order("min_qty"),
    costed ? loadCostBook() : Promise.resolve(null),
  ]);

  const breaksByProduct = new Map<string, { minQty: number; unitPrice: number }[]>();
  for (const r of (ladders.data ?? []) as {
    product_id: string;
    min_qty: number;
    unit_price: number;
  }[]) {
    const list = breaksByProduct.get(r.product_id) ?? [];
    list.push({ minQty: Number(r.min_qty), unitPrice: Number(r.unit_price) });
    breaksByProduct.set(r.product_id, list);
  }

  const presets: Preset[] = (products.data ?? []).map((p) => {
    const id = String(p.id);
    const cost = book?.mealCosts.get(id);
    return {
      id,
      name: String(p.name),
      minutes: Number(p.assembly_minutes) || 0,
      materials: cost?.costed ? cost.cost : null,
      price: Number(p.price) || 0,
      breaks: breaksByProduct.get(id) ?? [],
      // Which of the shop's questions get asked about this, decided by the
      // product's own categories rather than by anything typed on the desk.
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
    };
  });

  /*
   * The enquiry being priced, when there is one.
   *
   * Loaded here rather than posted from the browser for the same reason the
   * prices are: the desk is allowed to say what a job should cost, and only
   * the server is allowed to say which order it belongs to.
   */
  let existing: Existing | null = null;
  if (openOrderId) {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, ticket, contact_name, contact_phone, notes, scheduled_for, delivery_fee, uplift_kind, uplift_percent, order_lines(id, product_id, label, qty, price_at_sale, labour_minutes, unit_cost, spec, products(categories))"
      )
      .eq("id", openOrderId)
      .maybeSingle();

    if (data) {
      existing = {
        id: String(data.id),
        ticket: data.ticket === null ? null : Number(data.ticket),
        contactName: String(data.contact_name ?? ""),
        contactPhone: String(data.contact_phone ?? ""),
        notes: String(data.notes ?? ""),
        // Back to a plain date. The column is a timestamp set to midday so a
        // timezone offset can never move it onto the day before.
        dueDate: data.scheduled_for ? String(data.scheduled_for).slice(0, 10) : "",
        deliveryFee: Number(data.delivery_fee) || 0,
        upliftKind: data.uplift_kind === "markup" ? "markup" : "margin",
        upliftPercent: Number(data.uplift_percent) || 60,
        lines: (data.order_lines ?? []).map((l) => {
          const answers = parseSpec(l.spec);
          // PostgREST hands an embedded row back as an object or a
          // single-element array depending on how it read the relationship,
          // and the inferred type is not always the one that arrives.
          const joined = (Array.isArray(l.products) ? l.products[0] : l.products) as
            | { categories?: unknown }
            | null
            | undefined;
          const productCategories = Array.isArray(joined?.categories)
            ? joined.categories.map(String)
            : [];
          return {
            label: String(l.label ?? ""),
            qty: Number(l.qty) || 1,
            minutesEach: Number(l.labour_minutes) || 0,
            materialsEach: Number(l.unit_cost) || 0,
            // An enquiry carries no price, and a zero here would read as a
            // person having decided the job is free.
            priceEach: Number(l.price_at_sale) > 0 ? Number(l.price_at_sale) : null,
            productId: l.product_id === null ? null : String(l.product_id),
            // A bespoke line has no product to take its kind from, so it is
            // worked back out of the answers it already carries. Losing it
            // would drop every category-scoped answer the customer gave.
            categories:
              productCategories.length > 0
                ? productCategories
                : categoriesForAnswers(questions, answers),
            spec: valuesOf(answers),
          };
        }),
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>
          {existing ? `Price enquiry #${existing.ticket ?? ""}`.trim() : "Quote"}
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/70">
          {existing ? (
            <>
              Everything {existing.contactName || "they"} already told us is
              here, answers and all. Put a price on it and it goes back to them
              as a quote — same order, same place on the board.
            </>
          ) : (
            <>
              Work out what to charge for something that isn&apos;t in the{" "}
              {brand.copy.catalogue.toLowerCase()} yet. The cost, the date and
              the margin all move together, so you can answer while
              they&apos;re still asking.
            </>
          )}
        </p>
      </div>

      <QuoteDesk
        operating={operating}
        days={days}
        presets={presets}
        questions={questions}
        existing={existing}
        today={today}
      />
    </div>
  );
}
