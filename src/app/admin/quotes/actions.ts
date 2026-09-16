"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";
import { getOperating } from "@/lib/operating-server";
import { getSpecQuestions } from "@/lib/spec-server";
import { answersFrom, missingRequired, questionsFor, specJson } from "@/lib/spec";
import { quote, QUOTE_VALID_DAYS, type Uplift } from "@/lib/quote";
import type { PriceBreak } from "@/lib/price-breaks";
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
    /**
     * The catalogue row this line came from, when it came from one.
     *
     * The id, not the price. The price and its ladder are looked up here
     * from the database — a total arriving from a browser is a total anybody
     * can type, and this one decides what a customer is charged.
     */
    productId?: string | null;
    /**
     * What kind of work this is, which decides which questions apply.
     * From the product for a catalogue line, from the desk for a bespoke one.
     */
    categories?: string[];
    /**
     * The answers as typed, keyed by question.
     *
     * The answers, not the finished spec. The wording stored beside each one
     * is read from the questions table on this side — a browser may say what
     * a customer answered, never what the shop asked.
     */
    spec?: Record<string, string>;
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
  const [operating, questions] = await Promise.all([getOperating(), getSpecQuestions()]);

  /*
   * A required question with no answer stops the quote here.
   *
   * The desk already greys the save button out, which is the kind thing to
   * do and not a guarantee of anything — this is. The shop marked it
   * required because the job cannot be started without it, and an order that
   * cannot be started is worse on the board than an enquiry that was never
   * written down.
   */
  const asked = lines.map((l) => questionsFor(questions, l.categories ?? []));
  for (const [i, qs] of asked.entries()) {
    const gaps = missingRequired(qs, lines[i]?.spec ?? {});
    if (gaps.length > 0) {
      return {
        ok: false,
        error: `"${lines[i]?.label.trim()}" still needs: ${gaps.map((g) => g.label).join(", ")}.`,
      };
    }
  }

  /*
   * The published price for anything on this quote that the shop sells.
   *
   * Read here rather than taken from the draft for the same reason the whole
   * quote is recomputed: the screen and the server run the same function, but
   * only one of them is allowed to decide what a customer is charged.
   */
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))] as string[];
  const listed = new Map<string, { price: number; breaks: PriceBreak[] }>();
  if (productIds.length > 0) {
    const [{ data: rows }, { data: ladders }] = await Promise.all([
      supabase.from("products").select("id, price").in("id", productIds),
      supabase
        .from("product_price_breaks")
        .select("product_id, min_qty, unit_price")
        .in("product_id", productIds),
    ]);
    for (const r of (rows ?? []) as { id: string; price: number }[]) {
      listed.set(String(r.id), { price: Number(r.price) || 0, breaks: [] });
    }
    for (const b of (ladders ?? []) as {
      product_id: string;
      min_qty: number;
      unit_price: number;
    }[]) {
      listed
        .get(String(b.product_id))
        ?.breaks.push({ minQty: Number(b.min_qty), unitPrice: Number(b.unit_price) });
    }
  }

  const priced = quote({
    lines: lines.map((l) => {
      const row = l.productId ? listed.get(l.productId) : undefined;
      return {
        ...l,
        label: l.label.trim(),
        listPrice: row?.price ?? null,
        breaks: row?.breaks ?? [],
      };
    }),
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
    priced.lines.map((l, i) => ({
      order_id: order.id,
      // A line that IS a catalogue product says so, so the stock engine and
      // the best-seller tally see it as one. Only the bespoke lines carry a
      // label instead.
      product_id: lines[i]?.productId ?? null,
      qty: l.qty,
      // Per unit, as the rest of the system reads it.
      price_at_sale: l.qty > 0 ? l.price / l.qty : 0,
      label: l.label,
      labour_minutes: l.minutesEach,
      unit_cost: l.qty > 0 ? l.cost / l.qty : 0,
      // The answers that make this the thing they asked for, with the shop's
      // own wording copied in beside each one. NULL when nothing was asked,
      // so "no questions" and "questions left blank" stay distinguishable.
      spec: specJson(answersFrom(asked[i] ?? [], lines[i]?.spec ?? {})),
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
