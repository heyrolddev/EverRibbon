"use client";
import { formatDateTime, money } from "@/lib/format";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPaymentStatus } from "@/app/admin/orders/actions";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  type PaymentMethod,
  type PaymentPlan,
  type PaymentStatus,
} from "@/lib/payments";


const TONE_CLASS = {
  good: "bg-ok-700 text-paper-50",
  wait: "bg-brand-700 text-paper-50",
  part: "bg-warn-500 text-paper-50",
  neutral: "bg-ink-950/10 text-ink-900",
} as const;

/**
 * The shop's record of whether money arrived. Nothing here can check GCash on
 * the shop's behalf — staff compare the reference against their own GCash
 * history and record the decision, so the wording avoids implying the site
 * verified anything itself.
 */
export function PaymentVerifier({
  orderId,
  method,
  status,
  plan,
  reference,
  receiptUrl,
  total,
  downpayment,
  downpaymentConfirmedAt,
}: {
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  plan: PaymentPlan;
  reference: string | null;
  receiptUrl: string | null;
  total: number;
  downpayment: number;
  downpaymentConfirmedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(next: PaymentStatus) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await setPaymentStatus(orderId, next);
        if (res.error) setError(res.error);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the payment.");
      }
    });
  }

  const isDownpayment = plan === "downpayment";
  // Derived, never stored twice: an edited order changes the balance here too.
  const balance = Math.max(0, total - downpayment);
  const needsChecking = method === "gcash" && status === "submitted";
  const balanceOwed = status === "partial" && balance > 0;

  return (
    <div
      className={`mt-3 rounded-xl px-4 py-3 text-sm ring-1 ${
        needsChecking
          ? "bg-accent-50 ring-accent-200/50"
          : balanceOwed
            ? "bg-chili-50 ring-warn-500/40"
            : "bg-paper-50 ring-ink-950/10"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-ink-950">
          {METHOD_LABEL[method] ?? "Cash"} · {money(total)}
          {isDownpayment && (
            <span className="ml-2 font-normal text-ink-900/70">
              {money(downpayment)} down · {money(balance)} balance
            </span>
          )}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            TONE_CLASS[STATUS_LABEL[status]?.tone ?? "neutral"]
          }`}
        >
          {STATUS_LABEL[status]?.admin ?? status}
        </span>
      </div>

      {reference && (
        <p className="mt-1.5 font-mono text-xs text-ink-900/70">Ref: {reference}</p>
      )}

      {receiptUrl && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-bold text-brand-700 hover:underline"
        >
          View receipt screenshot ↗
        </a>
      )}

      {needsChecking && (
        <p className="mt-2 text-xs text-ink-900/70">
          Check this reference in your GCash app
          {isDownpayment ? ` for ${money(downpayment)}` : ""} before confirming.
        </p>
      )}

      {downpaymentConfirmedAt && status !== "unpaid" && (
        <p className="mt-1 text-xs text-ink-900/60">
          Down payment confirmed{" "}
          {formatDateTime(downpaymentConfirmedAt)}
        </p>
      )}

      {balanceOwed && (
        <p className="mt-2 text-xs font-bold text-warn-700">
          ⚠ Collect {money(balance)} in cash on handover.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {/* A down payment gets its own confirm step, so nobody hands over food
            believing an order is settled when half of it isn't. */}
        {isDownpayment && status !== "partial" && status !== "paid" && (
          <button
            onClick={() => set("partial")}
            disabled={pending}
            className="rounded-full bg-warn-500 px-4 py-1.5 text-xs font-bold text-paper-50 transition-colors hover:bg-warn-700 disabled:opacity-60"
          >
            {pending ? "…" : `✓ Down payment received (${money(downpayment)})`}
          </button>
        )}

        {status !== "paid" ? (
          <button
            onClick={() => set("paid")}
            disabled={pending}
            className="rounded-full bg-ok-600 px-4 py-1.5 text-xs font-bold text-paper-50 transition-colors hover:bg-ok-700 disabled:opacity-60"
          >
            {pending
              ? "…"
              : balanceOwed
                ? `✓ Balance collected (${money(balance)})`
                : "✓ Mark paid in full"}
          </button>
        ) : (
          <button
            onClick={() => set("unpaid")}
            disabled={pending}
            className="rounded-full bg-ink-950/10 px-4 py-1.5 text-xs font-bold text-ink-900 transition-colors hover:bg-ink-950/20 disabled:opacity-60"
          >
            Undo — mark unpaid
          </button>
        )}

        {status === "paid" && (
          <button
            onClick={() => set("refunded")}
            disabled={pending}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-900 hover:text-brand-700 disabled:opacity-60"
          >
            Refunded
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-brand-800">{error}</p>}
    </div>
  );
}
