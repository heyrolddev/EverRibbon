import { isConfigured } from "@/lib/auth";
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { FALLBACK_STATUSES, type OrderStatusRow, type StatusTone } from "@/lib/order-statuses";

/**
 * The shop's own steps, read once per request.
 *
 * `cache` is React's per-request memo, not a timed one: several components on
 * a page ask for the statuses and the database is asked once. It does not
 * survive the request, so an owner editing a step sees it on the next load
 * rather than whenever a cache felt like expiring.
 */
export const getOrderStatuses = cache(async (): Promise<OrderStatusRow[]> => {
  // A clone with no credentials yet has no client to make. That is the state
  // every new shop starts in, and it used to throw out of here and take the
  // whole homepage down with a 500 — the first thing anyone saw of this
  // system. The fallback list is exactly what it is for.
  if (!isConfigured()) return FALLBACK_STATUSES;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_statuses")
    // One string literal, not a concatenation: the column list is what the
    // client infers the row type from, and a joined string infers as nothing.
    .select("key, label, sort_order, is_open, is_gate, delivery_only, commits_stock, is_fulfilled, is_cancellation, awaiting_customer, customer_note, tone, hint")
    .order("sort_order");

  // A database that has not run migration 0007 has no such table. Falling back
  // renders a working board rather than an empty screen with no explanation --
  // but only when there is genuinely nothing, so a shop that has deleted every
  // status sees that it has, instead of quietly getting someone else's list.
  if (error || !data?.length) return FALLBACK_STATUSES;

  return data.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    sortOrder: Number(r.sort_order) || 0,
    isOpen: Boolean(r.is_open),
    isGate: Boolean(r.is_gate),
    deliveryOnly: Boolean(r.delivery_only),
    commitsStock: Boolean(r.commits_stock),
    isFulfilled: Boolean(r.is_fulfilled),
    isCancellation: Boolean(r.is_cancellation),
    awaitingCustomer: Boolean(r.awaiting_customer),
    customerNote: r.customer_note == null ? null : String(r.customer_note),
    tone: (r.tone ?? "ink") as StatusTone,
    hint: r.hint == null ? null : String(r.hint),
  }));
});
