import "server-only";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { committedKeys } from "@/lib/order-statuses";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Moving stock, from the app's side.
 *
 * The work happens in Postgres (see `0016_stock_movement.sql`) because one
 * order touches a dozen materials and supabase-js has no transactions — a
 * failure half way through would leave stock partly deducted with no record
 * of how far it got. These are thin wrappers over that: they decide *when*
 * stock should move, and the database decides how.
 */

/**
 * The point at which the materials are really gone.
 *
 * Not at checkout: an order sits `pending` until someone at the shop accepts
 * it, and a customer who never gets confirmed shouldn't be holding pork on
 * the shelf. Not at `completed` either — by then it has been cooked and the
 * stock has been wrong for the whole service.
 *
 * `confirmed` is the moment the shop commits to making it, which is the
 * moment the materials stop being available for anything else. A counter
 * sale is created at `completed`, already past this line, so it applies the
 * instant it is rung up.
 */
export async function isCommitted(status: string): Promise<boolean> {
  return committedKeys(await getOrderStatuses()).includes(status);
}

/**
 * Take an order's materials off the shelf.
 *
 * Safe to call more than once — the database claims the order before touching
 * anything, so two staff confirming the same order on two phones deduct the
 * pork once. Returns the cost actually consumed, or null when the order had
 * already been applied.
 *
 * Never throws. A sale that was recorded but not deducted leaves the stock
 * count wrong until the next cycle count; a sale that failed to record
 * because stock movement failed is money missing from the day's takings.
 */
export async function applyOrderStock(orderId: string): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("apply_order_stock", {
    p_order_id: orderId,
  });
  if (error) {
    console.error(`[stock] apply ${orderId}: ${error.message}`);
    return null;
  }
  return data === null ? null : Number(data);
}

/**
 * Put a cancelled order's materials back.
 *
 * Returns false when the order had never been applied — a `pending` order
 * cancelled before anyone accepted it never took anything off the shelf, and
 * handing stock back for it would invent food that was never there.
 */
export async function reverseOrderStock(orderId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reverse_order_stock", {
    p_order_id: orderId,
  });
  if (error) {
    console.error(`[stock] reverse ${orderId}: ${error.message}`);
    return false;
  }
  return data === true;
}

/**
 * One call for "the status changed, do whatever stock needs doing".
 *
 * Kept in one place so the four routes that can change a status — the staff
 * board, the cancel dialog, a customer cancelling their own pending order,
 * and the counter — cannot drift apart on when stock moves. Both sides are
 * idempotent, so calling this on a status that needs nothing is free.
 */
export async function syncStockForStatus(
  orderId: string,
  status: string
): Promise<void> {
  if (status === "cancelled") {
    await reverseOrderStock(orderId);
    return;
  }
  if (await isCommitted(status)) {
    await applyOrderStock(orderId);
  }
  // `pending` is the only remaining case: nothing has been committed yet, and
  // nothing was ever deducted to give back.
}
