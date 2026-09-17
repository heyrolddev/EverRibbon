"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimOrder } from "@/app/track/[token]/actions";

/**
 * "This one is mine."
 *
 * Offered only on an order nobody owns. Once it is claimed the customer gets
 * the real thing — the order on their own page, the proof they can approve,
 * the deposit they can send — all of which already works and none of which a
 * link alone can do.
 *
 * Signed out, this is a sign-in link that comes back here rather than a
 * button that fails. Somebody who has just been quoted a price is the worst
 * possible person to hand a dead end.
 */
export function ClaimOrder({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <div className="rounded-2xl bg-paper-100 px-5 py-4 ring-1 ring-ink-950/10">
        <p className="text-sm text-ink-900/75">
          Sign in and this order becomes yours — then you can approve the photo
          and send the deposit from your own page.
        </p>
        <Link
          href={{ pathname: "/login", query: { next: `/track/${token}` } }}
          className="mt-3 inline-block rounded-full bg-[var(--accent-fill)] px-6 py-3 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-paper-100 px-5 py-4 ring-1 ring-ink-950/10">
      <p className="text-sm text-ink-900/75">
        Add this to your account and you can approve the photo and send the
        deposit from <strong className="text-ink-950">Your orders</strong>.
      </p>
      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await claimOrder(token);
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
        disabled={pending}
        className="mt-3 rounded-full bg-[var(--accent-fill)] px-6 py-3 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105 disabled:opacity-50"
      >
        {pending ? "Adding…" : "This is my order"}
      </button>
      {error && <p className="mt-2 text-sm text-bad-700">{error}</p>}
    </div>
  );
}
