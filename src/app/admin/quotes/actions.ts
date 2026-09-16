"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";
import { getOperating } from "@/lib/operating-server";
import { quote, QUOTE_VALID_DAYS, type Uplift } from "@/lib/quote";
import { addDays, shopToday } from "@/lib/format";

/**
 * Saving a quote.
 *
 * The prices are recomputed here from the inputs rather than trusted from the
 * browser. Not because the screen is wrong — it runs the same function — but
 * because a form post is an argument the server has no reason to accept: the
 * numbers that decide a margin arrive from the database on this side, and a
 * total typed by a client is a total anybody can type.
 *
 * A quote is an order in a quoted status, not a row in a quotes table. One
 * record follows the customer from enquiry to delivery, so nothing has to be
 * copied across at the moment they say yes — and copying is where the price
 * they agreed to and the price on the job start to differ.
 */

export type QuoteDraft = {
  contactName: string;
  contactPhone: string;
  notes: string;
  /** ISO date, or null while the customer is still deciding. */
  dueDate: string | null;
  upliftKind: Uplift;
  upliftPercent: number;
  deliveryFee: number;
  discount: number;
  rushFeePercent: number;
  lines: {
    label: string;
    qty: number;
    minutesEach: number;
    materialsEach: number;
    priceEach: number | null;
  }[];
};

type Result = { ok: true; id: string; ticket: number } | { ok: false; error: string };

/** The status a quote is saved in, if the shop has one by that name. */
const QUOTED = "quoted";

export async function saveQuote(draft: QuoteDraft): Promise<Result> {
  const viewer = await getViewer();
  if (!can(viewer, "orders")) return { ok: false, error: "You can't create orders." };

  const lines = draft.lines.filter((l) => l.label.trim() && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Add at least one item." };

  const supabase = await createClient();
  const operating = await getOperating();

  const priced = quote({
    lines: lines.map((l) => ({ ...l, label: l.label.trim() })),
    uplift: { kind: draft.upliftKind, percent: draft.upliftPercent },
    deliveryFee: draft.deliveryFee,
    discount: draft.discount,
    rushFeePercent: draft.rushFeePercent,
    op: operating,
  });

  /*
   * A shop that hasn't seeded the made-to-order statuses has no "quoted" to
   * save into, and `orders.status` is a foreign key — the insert would fail
   * with a constraint error nobody can act on. Fall back to the first open
   * status rather than inventing one.
   */
  const { data: statuses } = await supabase
    .from("order_statuses")
    .select("key")
    .eq("is_open", true)
    .order("sort_order");
  const keys = (statuses ?? []).map((s) => String(s.key));
  const status = keys.includes(QUOTED) ? QUOTED : keys[0];
  if (!status) return { ok: false, error: "No order statuses are set up yet." };

  const today = shopToday();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      date: today,
      status,
      fulfillment: draft.deliveryFee > 0 ? "delivery" : "pickup",
      contact_name: draft.contactName || null,
      contact_phone: draft.contactPhone || null,
      notes: draft.notes || null,
      // Midday, so a timezone offset can never move a due date onto the day
      // before — the same reason the date helpers work from midday.
      scheduled_for: draft.dueDate ? `${draft.dueDate}T12:00:00Z` : null,
      revenue: priced.total,
      cogs: priced.cost.materials + priced.cost.consumables,
      oe: priced.cost.labour,
      gross_profit: priced.total - priced.cost.materials - priced.cost.consumables,
      net_profit: priced.profit,
      delivery_fee: priced.deliveryFee,
      rush_fee: priced.rushFee,
      quoted_at: new Date().toISOString(),
      quote_valid_until: addDays(today, QUOTE_VALID_DAYS),
      uplift_kind: draft.upliftKind,
      uplift_percent: draft.upliftPercent,
      eta_minutes: Math.round(priced.minutes),
    })
    .select("id, ticket")
    .single();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "The quote could not be saved." };
  }

  const { error: lineError } = await supabase.from("order_lines").insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      product_id: null,
      qty: l.qty,
      // Per unit, as the rest of the system reads it.
      price_at_sale: l.qty > 0 ? l.price / l.qty : 0,
      label: l.label,
      labour_minutes: l.minutesEach,
      unit_cost: l.qty > 0 ? l.cost / l.qty : 0,
    }))
  );

  if (lineError) {
    // A quote with a header and no items is worse than no quote: it shows on
    // the board as work with nothing in it. Take the header back out.
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, error: lineError.message };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/capacity");
  return { ok: true, id: String(order.id), ticket: Number(order.ticket) };
}
