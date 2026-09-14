"use client";
import { money } from "@/lib/format";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/lib/cart-context";
import { PageHeader } from "@/components/page-header";
import { EmptyPan, EmptyState } from "@/components/spot-art";

export default function CartPage() {
  return (
    // useSearchParams needs a Suspense boundary to keep this page static.
    <Suspense fallback={<Cart missing={null} />}>
      <CartWithNotice />
    </Suspense>
  );
}

/** Names anything a reorder couldn't bring across, where they'll look for it. */
function CartWithNotice() {
  return <Cart missing={useSearchParams().get("missing")} />;
}

function Cart({ missing }: { missing: string | null }) {
  const { items, setQty, removeItem, total } = useCart();

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="Almost there"
        title="Your Cart"
        subtitle={
          items.length > 0
            ? "Review your order, then check out — pickup or delivery."
            : undefined
        }
      />

      <section className="mx-auto max-w-3xl px-6 py-14">
        {missing && (
          <p className="mb-6 rounded-2xl bg-accent-200/20 px-5 py-4 text-sm font-semibold text-ink-900">
            We couldn&apos;t add <strong>{missing}</strong> — it isn&apos;t on
            the menu right now. Everything else from that order is here.
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState
            art={<EmptyPan className="h-full w-full" />}
            title="Your cart is empty"
            action={
              <Link
                href="/menu"
                className="mt-2 inline-block rounded-full bg-brand-700 px-7 py-3 font-bold text-paper-50 transition-transform hover:scale-105"
              >
                Browse the menu →
              </Link>
            }
          >
            Your cart&apos;s still empty — the pan is waiting.
          </EmptyState>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.li
                    key={item.productId}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold text-ink-950">
                        {item.name}
                      </p>
                      <p className="text-sm text-ink-900/60">
                        {money(item.price)} each
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="flex items-center gap-1 rounded-full bg-paper-50 p-1 ring-1 ring-ink-950/10">
                        <button
                          onClick={() => setQty(item.productId, item.qty - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="grid h-8 w-8 place-items-center rounded-full font-bold text-ink-900 transition-colors hover:bg-brand-700 hover:text-paper-50"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold text-ink-950">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.productId, item.qty + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="grid h-8 w-8 place-items-center rounded-full font-bold text-ink-900 transition-colors hover:bg-brand-700 hover:text-paper-50"
                        >
                          +
                        </button>
                      </div>

                      <span className="hidden w-24 text-right font-display text-lg font-black text-brand-700 sm:block">
                        {money((item.price * item.qty))}
                      </span>

                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-sm font-semibold text-ink-900/50 transition-colors hover:text-brand-700"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <motion.div
              layout
              className="mt-8 flex flex-col gap-5 rounded-3xl bg-ink-950 p-7 text-paper-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-bold">Total</span>
                <span className="font-display text-3xl font-black text-accent-200">
                  {money(total)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="rounded-full bg-accent-200 px-7 py-4 text-center font-bold text-ink-950 transition-transform hover:scale-[1.02]"
              >
                Checkout →
              </Link>
              <Link
                href="/menu"
                className="text-center text-sm font-semibold text-paper-100/60 transition-colors hover:text-accent-200"
              >
                ← Browse the menu
              </Link>
            </motion.div>
          </>
        )}
      </section>
    </main>
  );
}
