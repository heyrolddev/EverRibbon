import type { Proof } from "@/lib/proofs";
import { isFulfilled } from "@/lib/order-statuses";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { parseSpec } from "@/lib/spec";
import { lineName } from "@/lib/order-lines";
import { brand } from "../../../config/index.ts";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState, OrderBag } from "@/components/spot-art";
import { OrderTracker, type TrackedOrder } from "@/components/order-tracker";
import { PushToggle } from "@/components/push-toggle";
import { pushConfigured } from "@/lib/push";
import type { ReviewableItem } from "@/components/order-review-panel";
import {
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentPlan,
  type PaymentStatus,
} from "@/lib/payments";

import { privatePage } from "@/lib/seo";

export const metadata = privatePage("My orders");

type OrderLine = {
  id: number;
  product_id: string;
  qty: number;
  price_at_sale: number;
  products: { name: string } | null;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  fulfillment: string;
  revenue: number;
  eta_minutes: number | null;
  scheduled_for: string | null;
  ticket: number | null;
  cancelled_reason: string | null;
  delivery_address: string | null;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  eta_set_at: string | null;
  payment_plan: string;
  downpayment_amount: number | null;
  downpayment_confirmed_at: string | null;
  order_lines: OrderLine[];
};

export default async function OrdersPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="flex-1">
        <PageHeader title="Your Orders" />
        <section className="mx-auto max-w-2xl px-6 py-14">
          <p className="rounded-3xl border-2 border-dashed border-brand-300 bg-paper-100 p-8 text-center text-ink-900/80">
            Ordering isn&apos;t set up yet.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex-1">
        <PageHeader
          eyebrow="Order history"
          title="Your Orders"
          subtitle="Sign in to see everything you've ordered."
        />
        <section className="mx-auto max-w-2xl px-6 py-14 text-center">
          <Link
            href="/login?next=/orders"
            className="inline-block rounded-full bg-brand-700 px-8 py-4 font-bold text-paper-50 transition-transform hover:scale-105"
          >
            Sign in →
          </Link>
        </section>
      </main>
    );
  }

  const statuses = await getOrderStatuses();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, ticket, created_at, status, fulfillment, revenue, eta_minutes, cancelled_reason, eta_set_at, scheduled_for, delivery_address, delivery_fee, payment_method, payment_status, payment_reference, payment_plan, downpayment_amount, downpayment_confirmed_at, order_lines(id, product_id, qty, price_at_sale, label, spec, products(name))"
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  // "You have no orders" is a lie when the query itself failed, and it's the
  // kind of lie that makes a customer order twice.
  if (ordersError) {
    return (
      <main className="under-nav mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl bg-brand-50 p-8 ring-2 ring-brand-700/40">
          <h1 className="font-display text-2xl font-black text-brand-800">
            We couldn&apos;t load your orders
          </h1>
          <p className="mt-2 text-sm text-ink-900/70">
            Your orders are safe — this is our problem, not yours. Please try
            again in a moment, or call us on {brand.contact.phone}.
          </p>
        </div>
      </main>
    );
  }

  const typedOrders = (orders ?? []) as unknown as Order[];

  /*
   * The proofs, in one query rather than one per order.
   *
   * Row-level security already restricts these to this customer's own orders,
   * so there is nothing to filter here — and re-implementing that filter in
   * the query is how the two rules start to disagree.
   */
  const { data: proofRows } = await supabase
    .from("order_proofs")
    .select("id, order_id, version, image_url, note, sent_at, decision, reply, decided_at")
    .in("order_id", typedOrders.map((o) => o.id).length ? typedOrders.map((o) => o.id) : ["none"])
    .order("version");

  const proofsByOrder = new Map<string, Proof[]>();
  for (const r of (proofRows ?? []) as Record<string, unknown>[]) {
    const key = String(r.order_id);
    const list = proofsByOrder.get(key) ?? [];
    list.push({
      id: Number(r.id),
      version: Number(r.version),
      imageUrl: String(r.image_url),
      note: r.note == null ? null : String(r.note),
      sentAt: String(r.sent_at),
      decision: (r.decision as Proof["decision"]) ?? null,
      reply: r.reply == null ? null : String(r.reply),
      decidedAt: r.decided_at == null ? null : String(r.decided_at),
    });
    proofsByOrder.set(key, list);
  }

  // Everything this customer has already rated, so a completed order shows
  // their existing stars rather than inviting a duplicate review.
  const { data: myReviewRows } = await supabase
    .from("reviews")
    .select("product_id, rating, comment")
    .eq("customer_id", user.id);

  const myReviews = new Map(
    ((myReviewRows ?? []) as { product_id: string | null; rating: number; comment: string | null }[])
      .map((r) => [r.product_id ?? "__shop__", { rating: r.rating, comment: r.comment }])
  );

  const reviewableFor = (o: Order): ReviewableItem[] => {
    // Only a purchase that actually reached the customer can be reviewed.
    // Keyed to the name "completed" this returned nothing on any shop whose
    // last step is called something else, so the review panel simply never
    // appeared and the shop concluded its customers do not review things.
    if (!isFulfilled(statuses, o.status)) return [];
    // One row per distinct product — ordering the same thing twice shouldn't ask
    // for two reviews of it.
    const seen = new Map<string, string>();
    for (const l of o.order_lines ?? []) {
      const id = (l as unknown as { product_id?: string }).product_id;
      if (id && !seen.has(id)) seen.set(id, lineName(l));
    }
    return [
      {
        productId: null,
        label: `${brand.name} overall`,
        sublabel: "Service, speed, the whole experience",
        existing: myReviews.get("__shop__") ?? null,
      },
      ...[...seen.entries()].map(([id, name]) => ({
        productId: id,
        label: name,
        existing: myReviews.get(id) ?? null,
      })),
    ];
  };

  const tracked: TrackedOrder[] = typedOrders.map((o) => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    fulfillment: o.fulfillment,
    revenue: Number(o.revenue),
    eta_minutes: o.eta_minutes,
    ticket: o.ticket === null ? null : Number(o.ticket),
    cancelled_reason: o.cancelled_reason,
    eta_set_at: o.eta_set_at,
    scheduled_for: o.scheduled_for,
    delivery_address: o.delivery_address,
    delivery_fee: Number(o.delivery_fee ?? 0),
    payment_method: (o.payment_method === "gcash" ? "gcash" : "cod") as PaymentMethod,
    payment_status: (PAYMENT_STATUSES as readonly string[]).includes(o.payment_status)
      ? (o.payment_status as PaymentStatus)
      : "unpaid",
    payment_reference: o.payment_reference,
    payment_plan: (o.payment_plan === "downpayment" ? "downpayment" : "full") as PaymentPlan,
    downpayment_amount: Number(o.downpayment_amount ?? 0),
    downpayment_confirmed_at: o.downpayment_confirmed_at,
    reviewable: reviewableFor(o),
    lines: (o.order_lines ?? []).map((l) => ({
      id: l.id,
      qty: Number(l.qty),
      price_at_sale: Number(l.price_at_sale),
      name: lineName(l),
      // Parsed here so a spec written by hand into the column renders the
      // same on the customer's page as on the board — or renders nothing,
      // rather than taking their order history down.
      spec: parseSpec((l as unknown as { spec?: unknown }).spec),
    })),
    proofs: proofsByOrder.get(String(o.id)) ?? [],
  }));

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="Order history"
        title="Your Orders"
        subtitle={
          tracked.length > 0
            ? "Track what's cooking and look back at everything you've ordered."
            : undefined
        }
      />

      <section className="mx-auto max-w-2xl px-6 py-14">
        {tracked.length === 0 ? (
          <EmptyState
            art={<OrderBag className="h-full w-full" />}
            title="No orders yet"
            action={
              <Link
                href="/menu"
                className="mt-2 inline-block rounded-full bg-brand-700 px-7 py-3 font-bold text-paper-50 transition-transform hover:scale-105"
              >
                Browse the menu →
              </Link>
            }
          >
            Your first craving is one click away.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Offered here rather than at checkout on purpose: a permission
                prompt in the middle of paying is a prompt people dismiss, and
                a dismissal is permanent. Someone who has just ordered and is
                now watching for it is the one moment the ask makes sense. */}
            {pushConfigured() && (
              <PushToggle
                audience="customer"
                variant="prompt"
                vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
              />
            )}
            <OrderTracker orders={tracked} customerId={user.id} statuses={statuses} />

            {/* Somewhere to go from here. Without it the only way back to the
                menu from a page full of finished orders is the header. */}
            <Link
              href="/menu"
              className="self-center rounded-full bg-brand-700 px-7 py-3 font-bold text-paper-50 transition-transform hover:scale-105"
            >
              Browse the menu →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
