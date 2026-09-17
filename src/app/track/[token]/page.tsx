import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { brand } from "../../../../config/index.ts";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/auth";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { looksLikeToken, parseTracked } from "@/lib/track";
import { TrackedOrderView } from "@/components/tracked-order-view";

/**
 * Where your order is, with no account.
 *
 * The enquiry form works and the quote desk works, and between them was a gap
 * nobody could cross: `orders` is readable by `customer_id = auth.uid()` and
 * almost nobody who enquires has ever signed in. The shop priced the job and
 * the person who asked found out by being telephoned, if somebody remembered.
 *
 * The link is the credential — the same bargain every parcel-tracking link
 * makes. What it may show is a fixed list inside one database function rather
 * than a policy somebody later relaxes by accident.
 */

// Never indexed. These are somebody's order, and the whole point is that the
// URL is the only way in.
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

// Nothing here may be cached: a customer refreshing after the shop moved
// their order is the one case this page exists for.
export const dynamic = "force-dynamic";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // A crawler walking /track/anything costs a 404 rather than a round trip.
  if (!looksLikeToken(token) || !isConfigured()) notFound();

  const supabase = await createClient();
  const [{ data, error }, statuses, viewer] = await Promise.all([
    supabase.rpc("order_by_token", { p_token: token }),
    getOrderStatuses(),
    supabase.auth.getUser(),
  ]);

  if (error) {
    return (
      <main className="mx-auto max-w-lg flex-1 px-6 py-24">
        <h1 className="font-display text-2xl font-black text-ink-950">
          We can&apos;t look that up right now
        </h1>
        <p className="mt-3 text-sm text-ink-900/70">
          Give it a minute and try again, or ring the shop on{" "}
          <a className="font-bold text-brand-700" href={`tel:${brand.contact.phoneHref}`}>
            {brand.contact.phone}
          </a>
          .
        </p>
      </main>
    );
  }

  const order = parseTracked(data);
  // A token nobody holds is a 404, not an empty order. Telling somebody their
  // job exists and has nothing in it is worse than telling them nothing.
  if (!order) notFound();

  return (
    <TrackedOrderView
      order={order}
      statuses={statuses}
      token={token}
      signedIn={Boolean(viewer.data.user)}
    />
  );
}
