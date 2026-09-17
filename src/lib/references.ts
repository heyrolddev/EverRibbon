/**
 * The photographs a customer sends to say what they mean.
 *
 * "Ganito po ang gusto ko" is the most common first message a made-to-order
 * shop gets — a picture of somebody else's bouquet, last year's sash, a
 * screenshot from a Facebook page. A form that can take the colours, the
 * date, the name to print and not the photograph is a form people abandon
 * for Messenger.
 *
 * They live in the private bucket beside the payment screenshots, and for the
 * same reason: a reference is usually a photograph of a person at a
 * graduation. It belongs in a world-readable bucket no more than a receipt
 * does.
 *
 * Pure, so the browser's limit and the server's are the same limit.
 */

/** Their own folder, away from the receipts and the product photographs. */
export const REFERENCE_PREFIX = "references";

/**
 * How many one enquiry may carry.
 *
 * Three is what somebody sending an example actually sends — the thing, a
 * close-up, and the one with the colour right. A form that offers ten is a
 * form that gets ten, and then somebody has to look at ten.
 */
export const MAX_REFERENCES = 3;

/**
 * The longest edge a stored reference keeps.
 *
 * It is looked at once, by one person, usually on a phone — 1400 is more
 * than that needs and still lets somebody zoom into the spelling on a sash.
 * The shrink happens in the browser, so what leaves a prepaid connection is
 * a couple of hundred kilobytes rather than four megabytes.
 */
export const REFERENCE_EDGE = 1400;

/** Slightly lower than the avatar's, because these are photographs of scenes. */
export const REFERENCE_QUALITY = 0.82;

/**
 * What may be stored after the browser has shrunk it.
 *
 * A backstop, not a wall: the shrink lands an order of magnitude below this,
 * so reaching it means something went wrong rather than something was big.
 */
export const MAX_REFERENCE_BYTES = 1_200_000;

/** Where one goes. Under the order, so a file found alone is traceable. */
export const referencePath = (
  orderId: string,
  ext: string,
  id = crypto.randomUUID()
) => `${REFERENCE_PREFIX}/${orderId}/${id}.${ext}`;

/**
 * The paths on a row, cleaned.
 *
 * The column is `text[]`, which arrives from PostgREST as an array of
 * anything — and the same tolerance the spec parser needs applies here, for
 * the same reason: a row somebody edited by hand must render the order
 * rather than take the board down.
 */
export function referencePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const path = typeof entry === "string" ? entry.trim() : "";
    // A URL in here is not a path. Signing one returns a working link to a
    // file whose name is an entire URL, which renders as a broken image
    // rather than as "no photograph".
    if (!path || /^https?:/i.test(path)) continue;
    if (path.includes("..")) continue;
    if (!out.includes(path)) out.push(path);
  }
  return out.slice(0, MAX_REFERENCES);
}

/** How long a signed link to a reference is good for. */
export const REFERENCE_LINK_SECONDS = 30 * 60;
