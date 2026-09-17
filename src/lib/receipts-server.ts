import "server-only";
import { signPrivate } from "@/lib/private-files-server";
import { RECEIPT_LINK_SECONDS, receiptRef, type ReceiptRow } from "@/lib/receipts";

/**
 * Signed links for a page of orders, in one round trip.
 *
 * Keyed by order id and missing an entry for any order with no screenshot,
 * so a caller reads it the same way whether the receipt is a new private one,
 * an old public one, or absent.
 *
 * Who may look is decided by `signPrivate`, which is also what the reference
 * photographs go through — one answer to "may this person see a file the
 * customer sent", rather than two that can drift apart.
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

  const links = await signPrivate(
    toSign.map((r) => r.path),
    RECEIPT_LINK_SECONDS
  );
  for (const { id, path } of toSign) {
    const link = links.get(path);
    if (link) out.set(id, link);
  }

  return out;
}
