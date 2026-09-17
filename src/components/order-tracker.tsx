"use client";
import { brand } from "../../config/index.ts";
import { formatDateTime, formatDateTimeFull, money } from "@/lib/format";

import { useState } from "react";
import { ticketOf } from "@/lib/tickets";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useOrderRealtime } from "@/lib/use-order-realtime";
import { cancelMyOrder, submitPayment, updateMyOrder } from "@/app/orders/actions";
import { LiveDotIcon } from "@/components/icons";
import { OrderReviewPanel, type ReviewableItem } from "@/components/order-review-panel";
import { ProofCard } from "@/components/proof-card";
import { SpecList } from "@/components/spec-list";
import type { SpecAnswer } from "@/lib/spec";
import type { Proof } from "@/lib/proofs";
import {
  awaitingCustomer,
  findStatus,
  isCancellation,
  isClosed,
  isFulfilled,
  needsShop,
  railFor,
  railIndex,
  type OrderStatusRow,
} from "@/lib/order-statuses";
import { ReorderButton } from "@/components/reorder-button";
import { EtaCountdown } from "@/components/eta-countdown";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  type PaymentMethod,
  type PaymentPlan,
  type PaymentStatus,
} from "@/lib/payments";

export type TrackedLine = {
  id: number;
  qty: number;
  price_at_sale: number;
  name: string;
  /**
   * What was agreed for this line, in the shop's own wording.
   *
   * Shown to the customer and not only to the shop, on purpose. They are
   * about to approve a photograph of it, and "did I say maroon or burgundy"
   * is a question they should be able to answer without scrolling back
   * through a chat thread.
   */
  spec: SpecAnswer[];
};

export type TrackedOrder = {
  id: string;
  /** The number the shop and the customer can both say out loud. */
  ticket: number | null;
  created_at: string;
  status: string;
  fulfillment: string;
  revenue: number;
  eta_minutes: number | null;
  cancelled_reason: string | null;
  delivery_address: string | null;
  delivery_fee: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  eta_set_at: string | null;
  scheduled_for: string | null;
  payment_plan: PaymentPlan;
  downpayment_amount: number;
  downpayment_confirmed_at: string | null;
  reviewable: ReviewableItem[];
  lines: TrackedLine[];
  /** Photographs sent for approval. Empty for a shop that does not send them. */
  proofs: Proof[];
};

/** The happy path, in order. `cancelled` deliberately sits outside it. */
/**
 * "Ready" is two different pieces of news depending on who is coming to whom.
 *
 * A pickup customer needs to know where to walk. A delivery customer needs to
 * know that nothing more will happen on this screen — the rider has their
 * number and will ring, so the useful instruction is to stop watching the page
 * and watch the phone. The countdown is gone by this point, and without a
 * replacement the page would just sit there saying "ready" with no next step.
 *
 * This is the one line the shop does not get to write, because it is about
 * which way the goods are travelling rather than about what the shop makes.
 */
function handoverBlurb(fulfillment: string): string {
  return fulfillment === "delivery"
    ? "Ready and waiting for a rider. They'll call or text you when they're close — keep your phone nearby. 📱"
    : `Ready for pickup! We're at ${brand.contact.street}, ${brand.contact.locality}.`;
}

function StatusRail({
  status,
  fulfillment,
  statuses,
}: {
  status: string;
  fulfillment: string;
  statuses: OrderStatusRow[];
}) {
  // The shop's own steps, in its own order. A rail of six names typed into
  // this file drew a customer's progress bar with no lit segments on it for
  // any shop that had named its steps differently.
  const steps = railFor(statuses, fulfillment);
  const current = railIndex(steps, status);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === 0 ? "bg-transparent" : done ? "bg-ok-600" : "bg-ink-950/12"
                }`}
              />
              <motion.span
                animate={active ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={active ? { repeat: Infinity, duration: 2 } : undefined}
                className={`mx-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors ${
                  done ? "bg-ok-600" : "bg-ink-950/12"
                }`}
              >
                {done && <span className="h-1.5 w-1.5 rounded-full bg-paper-50" />}
              </motion.span>
              <span
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === steps.length - 1
                    ? "bg-transparent"
                    : i < current
                      ? "bg-ok-600"
                      : "bg-ink-950/12"
                }`}
              />
            </div>
            <span
              className={`text-center text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${
                done ? "text-ink-950" : "text-ink-900/40"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  statuses,
}: {
  order: TrackedOrder;
  statuses: OrderStatusRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qtys, setQtys] = useState<Record<number, number>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.id, l.qty]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reference, setReference] = useState(order.payment_reference ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handleSubmitPayment() {
    setPayBusy(true);
    setPayError(null);
    const fd = new FormData();
    fd.set("orderId", order.id);
    fd.set("reference", reference);
    if (receipt) fd.set("receipt", receipt);
    try {
      const res = await submitPayment(fd);
      if (res.error) return setPayError(res.error);
      setPayOpen(false);
      setReceipt(null);
      router.refresh();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Could not send that payment detail.");
    } finally {
      setPayBusy(false);
    }
  }

  const cancelled = isCancellation(statuses, order.status);
  const editable = order.status === "pending";
  const balanceDue = Math.max(
    0,
    order.revenue + Number(order.delivery_fee) - order.downpayment_amount
  );
  const draftTotal = order.lines.reduce(
    (s, l) => s + (qtys[l.id] ?? l.qty) * Number(l.price_at_sale),
    0
  );

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await cancelMyOrder(order.id, "Cancelled from my orders page");
      if (res.error) return setError(res.error);
      setConfirmCancel(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel that order.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    setBusy(true);
    setError(null);
    try {
      const res = await updateMyOrder(
        order.id,
        order.lines.map((l) => ({ lineId: l.id, qty: qtys[l.id] ?? l.qty }))
      );
      if (res.error) return setError(res.error);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`overflow-hidden rounded-3xl ring-1 transition-opacity ${
        cancelled ? "bg-paper-100/60 ring-ink-950/10" : "bg-paper-100 ring-ink-950/10"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-950/10 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-ink-950">
            {formatDateTime(order.created_at)}
          </p>
          <p className="text-xs capitalize text-ink-900/60">
            {/* The ticket, not eight characters of a uuid.
                
                This is the number printed on the receipt, shown on the shop's
                board and searched in HQ — and until now the customer was the
                one person never shown it. Staff asking "what's your ticket?"
                was a question the customer had no way to answer. */}
            {order.fulfillment} · {ticketOf(order.ticket)}
          </p>
        </div>

        {cancelled ? (
          <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-paper-100">
            Cancelled
          </span>
        ) : (
          order.eta_minutes != null &&
          needsShop(statuses, order.status) && (
            <EtaCountdown minutes={order.eta_minutes} from={order.eta_set_at} />
          )
        )}
      </div>

      {!cancelled && (
        <div className="px-6 py-5">
          {order.scheduled_for && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-200 px-3 py-1 text-xs font-black text-ink-950">
              📅 Booked for {formatDateTimeFull(order.scheduled_for)}
            </p>
          )}

          <StatusRail
            status={order.status}
            fulfillment={order.fulfillment}
            statuses={statuses}
          />
          <p className="mt-4 text-center text-sm font-semibold text-ink-900">
            {/* Made and waiting is the one step where WHERE matters more than
                what, so the fulfilment decides it. Everything else is the
                shop's own note, which it can change without a deploy. */}
            {awaitingCustomer(statuses, order.status) && !isFulfilled(statuses, order.status)
              ? handoverBlurb(order.fulfillment)
              : (findStatus(statuses, order.status)?.customerNote ?? "")}
          </p>
        </div>
      )}

      {/* Above the lines and the money: until this is answered, nothing else
          on the card is what the customer came to do. */}
      {order.proofs.length > 0 && <ProofCard proofs={order.proofs} />}

      {cancelled && order.cancelled_reason && (
        <p className="px-6 py-4 text-sm text-ink-900/70">{order.cancelled_reason}</p>
      )}

      <ul className="flex flex-col gap-2 border-t border-ink-950/10 px-6 py-4 text-sm">
        {order.lines.map((l) => {
          const qty = qtys[l.id] ?? l.qty;
          return (
            <li key={l.id}>
              <div className="flex items-center justify-between gap-4">
              <span className={`text-ink-900 ${editing && qty === 0 ? "line-through opacity-50" : ""}`}>
                {l.name}
              </span>

              {editing ? (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Fewer ${l.name}`}
                    onClick={() => setQtys((q) => ({ ...q, [l.id]: Math.max(0, qty - 1) }))}
                    className="grid h-7 w-7 place-items-center rounded-full bg-ink-950/10 font-bold text-ink-950 hover:bg-ink-950/20"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-ink-950">{qty}</span>
                  <button
                    type="button"
                    aria-label={`More ${l.name}`}
                    onClick={() => setQtys((q) => ({ ...q, [l.id]: Math.min(99, qty + 1) }))}
                    className="grid h-7 w-7 place-items-center rounded-full bg-ink-950/10 font-bold text-ink-950 hover:bg-ink-950/20"
                  >
                    +
                  </button>
                </span>
              ) : (
                <span className="shrink-0 font-semibold text-ink-950">
                  {l.qty} × {money(l.price_at_sale)}
                </span>
              )}
              </div>
              <SpecList answers={l.spec} className="mt-1.5 pl-1" />
            </li>
          );
        })}
      </ul>

      {order.delivery_address && (
        <p className="border-t border-ink-950/10 px-6 py-3 text-sm text-ink-900/70">
          🛵 Delivering to {order.delivery_address}
        </p>
      )}

      <div className="flex flex-col gap-1.5 border-t border-ink-950/10 px-6 py-4">
        {Number(order.delivery_fee) > 0 && (
          <>
            <div className="flex justify-between text-sm text-ink-900/70">
              {/* What the shop calls the things it sells. The literal here
                  was "Food", on a page a ribbon shop's customer reads. */}
              <span>{brand.copy.catalogue}</span>
              <span>{money(editing ? draftTotal : order.revenue)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-900/70">
              <span>Delivery</span>
              <span>{money(order.delivery_fee)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-ink-950">Total</span>
          <span className="font-display text-lg font-black text-brand-700">
            {money((editing ? draftTotal : order.revenue) + Number(order.delivery_fee))}
          </span>
        </div>
      </div>

      {/* Payment */}
      {!cancelled && (
        <div className="border-t border-ink-950/10 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ink-900/70">
              {METHOD_LABEL[order.payment_method] ?? "Cash"}
              {order.payment_reference && (
                <span className="ml-2 font-mono text-xs text-ink-900/50">
                  {order.payment_reference}
                </span>
              )}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                STATUS_LABEL[order.payment_status]?.tone === "good"
                  ? "bg-ok-700 text-paper-50"
                  : STATUS_LABEL[order.payment_status]?.tone === "wait"
                    ? "bg-brand-700 text-paper-50"
                    : STATUS_LABEL[order.payment_status]?.tone === "part"
                      ? "bg-warn-500 text-paper-50"
                      : "bg-ink-950/10 text-ink-900"
              }`}
            >
              {STATUS_LABEL[order.payment_status]?.customer ?? order.payment_status}
            </span>
          </div>

          {/* A down payment has three states that must never look alike:
              sent-but-unchecked, confirmed by the shop, and settled. Amounts
              are derived from the current total, so an edited order never
              leaves a stale figure on screen. */}
          {order.payment_plan === "downpayment" && (
            <>
              {order.payment_status === "submitted" && (
                <p className="mt-2 rounded-xl bg-accent-50 px-4 py-2.5 text-xs font-semibold text-ink-950 ring-1 ring-accent-200/50">
                  ⏳ You sent {money(order.downpayment_amount)} — waiting for the
                  shop to confirm it.
                </p>
              )}

              {order.payment_status === "partial" && (
                <div className="mt-2 rounded-xl bg-ok-50 px-4 py-2.5 text-xs ring-1 ring-ok-600/40">
                  <p className="font-bold text-ok-700">
                    ✓ Down payment of {money(order.downpayment_amount)} confirmed
                    by the shop
                    {order.downpayment_confirmed_at && (
                      <span className="font-normal text-ink-900/60">
                        {" "}
                        ·{" "}
                        {formatDateTime(order.downpayment_confirmed_at)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-semibold text-ink-950">
                    {money(balanceDue)} still to pay in cash on handover.
                  </p>
                </div>
              )}

              {order.payment_status === "paid" && (
                <p className="mt-2 rounded-xl bg-ok-50 px-4 py-2.5 text-xs font-bold text-ok-700 ring-1 ring-ok-600/40">
                  ✓ Fully paid — {money(order.downpayment_amount)} down payment +{" "}
                  {money(balanceDue)} balance.
                </p>
              )}

              {order.payment_status === "unpaid" && (
                <p className="mt-2 rounded-xl bg-paper-50 px-4 py-2.5 text-xs font-semibold text-ink-900 ring-1 ring-ink-950/10">
                  {money(order.downpayment_amount)} down payment ·{" "}
                  {money(balanceDue)} on handover.
                </p>
              )}
            </>
          )}

          {/* Only correctable while the shop hasn't confirmed the money.
              Once it's 'partial' or 'paid' the reference is the shop's
              record — re-submitting would knock a confirmed payment back to
              "needs checking", which the database also refuses. */}
          {order.payment_method === "gcash" &&
            !["partial", "paid"].includes(order.payment_status) && (
            <div className="mt-3">
              {payOpen ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-ink-900/70">
                    Send us <span className="text-brand-800">either</span> the
                    reference number or a screenshot — whichever is easier.
                  </p>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="GCash reference number"
                    className="rounded-xl border-2 border-ink-950/15 bg-paper-50 px-4 py-2 text-sm outline-none focus:border-brand-700"
                  />
                  <label className="text-xs font-semibold text-ink-900/70">
                    …or a screenshot of the GCash receipt
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-xs"
                    />
                  </label>
                  {payError && (
                    <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
                      {payError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitPayment}
                      disabled={payBusy}
                      className="rounded-full bg-brand-700 px-4 py-2 text-xs font-bold text-paper-50 disabled:opacity-60"
                    >
                      {payBusy ? "Sending…" : "Send to the shop"}
                    </button>
                    <button
                      onClick={() => {
                        setPayOpen(false);
                        setPayError(null);
                      }}
                      className="rounded-full px-4 py-2 text-xs font-bold text-ink-900 hover:text-brand-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPayOpen(true)}
                  className="rounded-full bg-ink-950 px-4 py-2 text-xs font-bold text-paper-50 transition-colors hover:bg-brand-700"
                >
                  {order.payment_reference ? "Update payment details" : "Add payment details"}
                </button>
                )}
              </div>
            )}
        </div>
      )}

      {/* Offered on anything that's finished — including a cancelled one,
          where wanting the same food again is exactly the recovery. */}
      {(isFulfilled(statuses, order.status) || cancelled) && (
        <div className="border-t border-ink-950/10 px-6 py-4">
          <ReorderButton orderId={order.id} />
        </div>
      )}

      {isFulfilled(statuses, order.status) && order.reviewable.length > 0 && (
        <OrderReviewPanel items={order.reviewable} />
      )}

      {error && (
        <p className="mx-6 mb-4 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2 border-t border-ink-950/10 px-6 py-4">
          {editing ? (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={busy}
                className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-paper-50 transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setQtys(Object.fromEntries(order.lines.map((l) => [l.id, l.qty])));
                  setError(null);
                }}
                className="rounded-full px-5 py-2 text-sm font-bold text-ink-900 hover:text-brand-700"
              >
                Cancel edit
              </button>
            </>
          ) : confirmCancel ? (
            <>
              <span className="w-full text-sm font-semibold text-ink-900">
                Cancel this order for good?
              </span>
              <button
                onClick={handleCancel}
                disabled={busy}
                className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-paper-50 disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Yes, cancel it"}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="rounded-full px-5 py-2 text-sm font-bold text-ink-900 hover:text-brand-700"
              >
                Keep it
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded-full bg-ink-950 px-5 py-2 text-sm font-bold text-paper-50 transition-colors hover:bg-brand-700"
              >
                Edit order
              </button>
              <button
                onClick={() => setConfirmCancel(true)}
                className="rounded-full px-5 py-2 text-sm font-bold text-ink-900 hover:text-brand-700"
              >
                Cancel order
              </button>
              <span className="self-center text-xs text-ink-900/55">
                You can change this until the shop confirms it.
              </span>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function OrderTracker({
  orders,
  customerId,
  statuses,
}: {
  orders: TrackedOrder[];
  customerId: string;
  /** The shop's own steps, fetched on the server and handed down. */
  statuses: OrderStatusRow[];
}) {
  const { connected } = useOrderRealtime({ customerId });

  const active = orders.filter((o) => !isClosed(statuses, o.status));
  const past = orders.filter((o) => isClosed(statuses, o.status));

  return (
    <div className="flex flex-col gap-10">
      {active.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black text-ink-950">
              Happening now
            </h2>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                connected ? "bg-ok-700 text-paper-50" : "bg-ink-950/10 text-ink-900"
              }`}
            >
              <LiveDotIcon className={`h-2 w-2 ${connected ? "animate-pulse" : "opacity-50"}`} />
              {connected ? "Live" : "Connecting…"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-900/60">
            This updates by itself — no need to refresh.
          </p>
          <ul className="mt-5 flex flex-col gap-5">
            <AnimatePresence initial={false}>
              {active.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <OrderCard order={o} statuses={statuses} />
                </motion.div>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {past.length > 0 && <History orders={past} statuses={statuses} />}
    </div>
  );
}

/**
 * Finished orders, folded down to the most recent one.
 *
 * A regular builds a long list quickly, and the twentieth order from three
 * months ago is not what anyone opens this page for — but it still pushed
 * everything useful off the screen. Only the newest shows; the rest are one
 * tap away, and the button says how many so nobody has to wonder whether
 * their history survived.
 *
 * Orders still in flight are never folded: those are the reason to be here.
 */
function History({
  orders,
  statuses,
}: {
  orders: TrackedOrder[];
  statuses: OrderStatusRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? orders : orders.slice(0, 1);
  const hidden = orders.length - shown.length;

  return (
    <section>
      <h2 className="font-display text-2xl font-black text-ink-950">History</h2>
      <ul className="mt-5 flex flex-col gap-5">
        {shown.map((o) => (
          <OrderCard key={o.id} order={o} statuses={statuses} />
        ))}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-5 w-full rounded-2xl bg-paper-100 px-5 py-3 text-sm font-bold text-ink-950 ring-1 ring-ink-950/10 transition-colors hover:bg-paper-200"
        >
          Show {hidden} more order{hidden === 1 ? "" : "s"} ↓
        </button>
      )}

      {expanded && orders.length > 1 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 w-full rounded-2xl px-5 py-2 text-sm font-bold text-ink-900/60 transition-colors hover:text-brand-700"
        >
          Show less ↑
        </button>
      )}
    </section>
  );
}
