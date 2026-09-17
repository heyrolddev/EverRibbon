import Link from "next/link";

import { brand } from "../../config/index.ts";
import {
  isCancellation,
  labelOf,
  toneClasses,
  toneOf,
  type OrderStatusRow,
} from "@/lib/order-statuses";
import { formatDate, formatDateTime, money } from "@/lib/format";
import { isQuoted, trackedTotal, type TrackedByLink } from "@/lib/track";
import { SpecList } from "@/components/spec-list";
import { ClaimOrder } from "@/components/claim-order";
import { PageHeader } from "@/components/page-header";

/**
 * An order as somebody holding a link sees it.
 *
 * Separate from the page so the page does one thing — decide whether the
 * token is real and fetch the row — and this does the other. It is also the
 * only way to look at this screen without a database behind it, which for a
 * page that exists to be sent to a stranger is worth the file.
 */
function note(statuses: OrderStatusRow[], key: string): string | null {
  return statuses.find((s) => s.key === key)?.customerNote ?? null;
}

export function TrackedOrderView({
  order,
  statuses,
  token,
  signedIn,
}: {
  order: TrackedByLink;
  statuses: OrderStatusRow[];
  token: string;
  signedIn: boolean;
}) {
  const tone = toneClasses(toneOf(statuses, order.status));
  const cancelled = isCancellation(statuses, order.status);
  const quoted = isQuoted(order);
  const total = trackedTotal(order);
  const deposit =
    order.paymentPlan === "downpayment" ? order.downpaymentAmount : 0;

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow={order.ticket ? `Order #${order.ticket}` : "Your order"}
        title={cancelled ? "This order didn't go ahead" : labelOf(statuses, order.status)}
        subtitle={cancelled ? (order.cancelledReason ?? undefined) : (note(statuses, order.status) ?? undefined)}
        compact
      />

      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 pb-24 pt-10">
        {/* ------------------------------------------------- what they asked -- */}
        <div className="rounded-3xl bg-paper-50 p-6 ring-1 ring-ink-950/10 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${tone.chip}`}
            >
              {labelOf(statuses, order.status)}
            </span>
            <span className="font-mono text-xs text-ink-900/45">
              Asked {formatDateTime(order.createdAt)}
            </span>
          </div>

          {order.notes && (
            <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-ink-900/75">
              {order.notes}
            </p>
          )}

          <ul className="mt-5 flex flex-col gap-3 border-t border-ink-950/10 pt-4">
            {order.lines.map((l, i) => (
              <li key={i}>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-ink-900">
                    {l.qty} × {l.name}
                  </span>
                  {l.price > 0 && (
                    <span className="font-semibold text-ink-950">
                      {money(l.qty * l.price)}
                    </span>
                  )}
                </div>
                <SpecList answers={l.spec} className="mt-1.5 pl-1" />
              </li>
            ))}
          </ul>

          {order.scheduledFor && (
            <p className="mt-4 text-sm text-ink-900/70">
              For <strong className="text-ink-950">{formatDate(order.scheduledFor)}</strong>
            </p>
          )}
        </div>

        {/* -------------------------------------------------------- the price -- */}
        {quoted ? (
          <div className="rounded-3xl bg-ink-950 p-6 text-paper-100 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-400">
              Your quote
            </p>
            <p className="mt-1 font-display text-4xl font-black">{money(total)}</p>
            <ul className="mt-4 flex flex-col gap-1 text-sm text-paper-100/70">
              {order.deliveryFee > 0 && <li>Includes {money(order.deliveryFee)} delivery</li>}
              {order.rushFee > 0 && <li>Includes {money(order.rushFee)} for the date</li>}
              {deposit > 0 && (
                <li className="text-paper-100">
                  {money(deposit)} to start, the rest before it goes out
                </li>
              )}
            </ul>
            {order.quoteValidUntil && (
              <p className="mt-4 text-xs text-paper-100/55">
                This price stands until {formatDate(order.quoteValidUntil)}. Ribbon is
                bought by the roll at a price that moves, so we can&apos;t hold it
                longer than that.
              </p>
            )}
          </div>
        ) : (
          !cancelled && (
            <div className="rounded-3xl bg-paper-100 px-6 py-5 ring-1 ring-ink-950/10">
              <p className="text-sm text-ink-900/75">
                No price on this yet. We&apos;ll work it out and it will appear
                here — nothing is agreed and nothing is owed until you say yes.
              </p>
            </div>
          )
        )}

        {/* -------------------------------------------------------- the proof -- */}
        {order.proof && (
          <div className="overflow-hidden rounded-3xl bg-paper-50 ring-1 ring-ink-950/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-6">
              <h2 className="font-display text-lg font-black text-ink-950">
                {order.proof.decision === "approved"
                  ? "You approved this"
                  : order.proof.decision === "changes"
                    ? "We're making the change you asked for"
                    : "Have a look before we make it"}
              </h2>
              <span className="font-mono text-[11px] text-ink-900/45">
                {order.proof.version > 1 ? `Version ${order.proof.version}` : ""}
              </span>
            </div>
            {order.proof.note && (
              <p className="mt-2 px-6 text-sm text-ink-900/75">{order.proof.note}</p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.proof.imageUrl}
              alt={`Proof, version ${order.proof.version}`}
              className="mt-4 max-h-[26rem] w-full bg-ink-950/5 object-contain"
            />
            {order.proof.decision === null && (
              <p className="px-6 py-4 text-sm text-ink-900/70">
                Nothing is cut or printed until you approve it. Add this order to
                an account below and you can answer here; or just reply to us.
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------- what's next -- */}
        {!cancelled &&
          (order.claimed ? (
            <div className="rounded-2xl bg-paper-100 px-5 py-4 ring-1 ring-ink-950/10">
              <p className="text-sm text-ink-900/75">
                This order is on an account. Sign in and it&apos;s under{" "}
                <Link href="/orders" className="font-bold text-brand-700 hover:underline">
                  Your orders
                </Link>
                , where you can approve the photo and send payment.
              </p>
            </div>
          ) : (
            <ClaimOrder token={token} signedIn={signedIn} />
          ))}

        <p className="px-1 text-xs text-ink-900/50">
          Anything not right?{" "}
          <a className="font-bold text-brand-700" href={`tel:${brand.contact.phoneHref}`}>
            {brand.contact.phone}
          </a>{" "}
          — {order.contactName ? `ask for ${order.contactName}'s order` : "quote the order number"}
          {order.ticket ? ` #${order.ticket}` : ""}.
        </p>
      </section>
    </main>
  );
}
