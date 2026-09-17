/**
 * Where a payment screenshot lives, and how it is allowed to be looked at.
 *
 * A GCash receipt carries a person's full name, their phone number, the
 * amount they paid and a reference number. It used to go into the same public
 * bucket as the product photographs and be stored as a public URL, which
 * meant anyone who could read that bucket could read every one of them.
 * Nothing ever failed — a public bucket serves a private file exactly as
 * cheerfully as it serves a photograph of a bouquet.
 *
 * So there are two columns now, and this module is the one place that knows
 * what the pair means:
 *
 *   payment_receipt_path   a path in the shop's PRIVATE bucket. Everything
 *                          uploaded from now on. Served only as a short,
 *                          signed link minted for somebody already checked.
 *   payment_receipt_url    LEGACY. A public URL from before. Still read,
 *                          because it is the evidence behind payments the
 *                          shop already confirmed, and never written again.
 *
 * Pure, so the decision is testable and so the two readers — the order board
 * and the payments ledger — cannot disagree about which column wins.
 */

/** The shop's private bucket, derived from the public one rather than typed. */
export const privateBucketOf = (mediaBucket: string) => `${mediaBucket}-private`;

/** Receipts keep their own folder, as they did in the public bucket. */
export const RECEIPT_PREFIX = "receipts";

export type ReceiptRow = {
  payment_receipt_path?: string | null;
  payment_receipt_url?: string | null;
};

export type ReceiptRef =
  /** In the private bucket. Needs signing before anybody can see it. */
  | { kind: "private"; path: string }
  /** Already public, from before. Shown as-is; there is nothing to sign. */
  | { kind: "legacy"; url: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Which of the two a row is carrying, if either.
 *
 * The private path wins when both are set. A row can only hold both if it was
 * paid before the change and re-submitted after, and in that case the newer
 * file is the one the customer meant — and it is the one that is not world
 * readable.
 */
export function receiptRef(row: ReceiptRow): ReceiptRef | null {
  const path = text(row.payment_receipt_path);
  // A path is a path. Anything that looks like a URL in this column is not
  // something to hand to the signer, which would return a link to a file
  // whose name is an entire URL.
  if (path && !/^https?:/i.test(path)) return { kind: "private", path };

  const url = text(row.payment_receipt_url);
  if (url) return { kind: "legacy", url };
  return null;
}

/** Whether there is a screenshot at all, whichever column it is on. */
export const hasReceipt = (row: ReceiptRow) => receiptRef(row) !== null;

/**
 * How long a signed link is good for.
 *
 * Ten minutes: long enough to open it, zoom in and check a reference number
 * against the GCash app, and short enough that a link pasted into a group
 * chat is dead before anybody else taps it.
 */
export const RECEIPT_LINK_SECONDS = 10 * 60;

/**
 * Where a new receipt goes.
 *
 * Under the order it belongs to, so a file found on its own is traceable
 * rather than anonymous — and so deleting an order's evidence is one prefix
 * rather than a search.
 */
export const receiptPath = (orderId: string, ext: string, id = crypto.randomUUID()) =>
  `${RECEIPT_PREFIX}/${orderId}/${id}.${ext}`;
