"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";
import { getOperating } from "@/lib/operating-server";
import { getSpecQuestions } from "@/lib/spec-server";
import { notifyOrderStatus } from "@/lib/notify";
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
  /**
   * The enquiry being priced, when this is a price for something already on
   * the board rather than a new job typed from scratch.
   *
   * The same record all the way through — an enquiry, a quote and a delivered
   * order are one row at different moments. Making a second row here is how
   * the thing the customer asked for and the thing being made start to
   * differ, and how the board ends up showing both.
   */
  orderId?: string | null;
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

/**
 * Put a price on an order that already exists.
 *
 * Refused once any money has moved. Up to that point a quote is an offer and
 * rewriting it is ordinary; after a deposit it is what the shop agreed to
 * take, and quietly rewriting it would change what a customer owes on an
 * order they have already paid into.
 */
async function repriceOrder(
  orderId: string,
  fields: Record<string, unknown>
): Promise<
  | { ok: true; order: { id: string; ticket: number | null } }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from("orders")
    .select("id, ticket, status, payment_status, order_statuses(is_open, is_cancellation)")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!existing) return { ok: false, error: "That order is gone." };

  const step = existing.order_statuses as unknown as
    | { is_open: boolean; is_cancellation: boolean }
    | null;
  // Asked of the step's own meaning, never of its name: a shop that calls its
  // last step something else would otherwise have every finished order
  // quotable again.
  if (step && (!step.is_open || step.is_cancellation)) {
    return { ok: false, error: "That order is finished or cancelled — it can't be re-quoted." };
  }
  if (existing.payment_status !== "unpaid") {
    return {
      ok: false,
      error:
        "They have already paid something on this. Changing the price now would change what they owe on an order they have paid into — take it up with them first.",
    };
  }

  const { data, error: updateError } = await supabase
    .from("orders")
    .update(fields)
    .eq("id", orderId)
    // Only while it is still unpaid. Between the check above and this line a
    // deposit can land, and this is what makes that a no-op rather than a
    // repriced order somebody has already paid into.
    .eq("payment_status", "unpaid")
    .select("id, ticket")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!data) {
    return { ok: false, error: "A payment landed on this while you were pricing it. Reload and look." };
  }

  return {
    ok: true,
    order: { id: String(data.id), ticket: data.ticket === null ? null : Number(data.ticket) },
  };
}

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

  /*
   * Everything a quote decides, whether it is being written or rewritten.
   *
   * The status moves to "quoted" either way — including backwards, from a
   * step the order had already reached. That is the point rather than a side
   * effect: a price that changed is a price the customer has not agreed to
   * yet, and an order sitting at "agreed" under a number nobody agreed to is
   * the worst of the two states to be in.
   */
  const quoteFields = {
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
  };

  const reprice = draft.orderId ? await repriceOrder(draft.orderId, quoteFields) : null;
  if (reprice && !reprice.ok) return reprice;

  const { data: order, error } = reprice
    ? { data: reprice.order, error: null }
    : await supabase
        .from("orders")
        .insert({ date: today, ...quoteFields })
        .select("id, ticket")
        .single();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "The quote could not be saved." };
  }

  // A repriced order keeps its id and loses its old lines. Replacing rather
  // than patching, because a quote is a whole answer: an item dropped from
  // the second version has to actually leave.
  if (reprice) await supabase.from("order_lines").delete().eq("order_id", order.id);

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
    // the board as work with nothing in it. Take a NEW header back out — a
    // repriced one is somebody's enquiry, and deleting it because the second
    // version failed to save would lose the first.
    if (!reprice) await supabase.from("orders").delete().eq("id", order.id);
    return {
      ok: false,
      error: reprice
        ? `${lineError.message} — the enquiry is still there, with no items on it. Try again.`
        : lineError.message,
    };
  }

  if (reprice) {
    // A price landing on somebody's enquiry is the one status change on this
    // whole board they are actually waiting for. Only on a reprice: a quote
    // typed from scratch has no customer attached to tell.
    //
    // Not awaited — the quote is saved, and a slow push must not be a slow
    // save while somebody is on the phone.
    void notifyOrderStatus(String(order.id));
    revalidatePath(`/track/${draft.orderId}`);
    revalidatePath("/orders");
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/capacity");
  return { ok: true, id: String(order.id), ticket: Number(order.ticket) };
}
