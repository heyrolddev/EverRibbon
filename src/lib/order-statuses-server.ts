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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_statuses")
    .select("key, label, sort_order, is_open, is_gate, delivery_only, commits_stock, tone, hint")
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
    tone: (r.tone ?? "ink") as StatusTone,
    hint: r.hint == null ? null : String(r.hint),
  }));
});
