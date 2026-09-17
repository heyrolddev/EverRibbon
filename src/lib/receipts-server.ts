import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getViewer } from "@/lib/auth";
import { PRIVATE_BUCKET } from "@/lib/media";
import { RECEIPT_LINK_SECONDS, receiptRef, type ReceiptRow } from "@/lib/receipts";

/**
 * A link to a payment screenshot, good for ten minutes.
 *
 * The check is in here rather than only at the call sites. Signing is done
 * with the service-role client — it has to be, the bucket is private — and a
 * function that mints a link to anybody's receipt for whoever calls it is one
 * careless import away from being the same hole in a new place. So it asks
 * who is looking, every time, and a caller that forgot to check is still
 * safe.
 *
 * Staff, not owner. Confirming a customer's GCash reference against the app
 * is counter work, and it was already what the order board offered — this
 * change is about the file not being world-readable, not about taking the
 * screen away from the people who use it.
 */
async function signer() {
  if (!can(await getViewer(), "orders")) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient();
}

/**
 * Signed links for a page of orders, in one round trip.
 *
 * Keyed by order id and missing an entry for any order with no screenshot,
 * so a caller reads it the same way whether the receipt is a new private one,
 * an old public one, or absent.
 */
export async function signReceipts(
  rows: (ReceiptRow & { id: string })[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  // Split first: the legacy ones need no signing and no network at all, and
  // asking storage to sign a path that is really an old public URL would
  // come back with a link to a file that does not exist.
  const toSign: { id: string; path: string }[] = [];
  for (const row of rows) {
    const ref = receiptRef(row);
    if (!ref) continue;
    if (ref.kind === "legacy") out.set(row.id, ref.url);
    else toSign.push({ id: row.id, path: ref.path });
  }
  if (toSign.length === 0) return out;

  const client = await signer();
  // No credentials, or not somebody who may look. Every private receipt is
  // simply absent, which the screen already knows how to draw — an order with
  // no screenshot is an ordinary thing.
  if (!client) return out;

  try {
    const { data, error } = await client.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrls(
        toSign.map((r) => r.path),
        RECEIPT_LINK_SECONDS
      );
    if (error || !data) return out;

    // `createSignedUrls` answers in the order it was asked, and reports a
    // per-file error rather than failing the batch — one deleted file must
    // not take the other twelve links down with it.
    data.forEach((signed, i) => {
      const asked = toSign[i];
      if (asked && signed.signedUrl && !signed.error) out.set(asked.id, signed.signedUrl);
    });
  } catch {
    // A page of orders that renders without receipt links beats a page that
    // does not render.
  }

  return out;
}
