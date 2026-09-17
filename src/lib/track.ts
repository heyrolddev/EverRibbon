import { parseSpec, type SpecAnswer } from "./spec.ts";

/**
 * An order seen through a link, with no account behind it.
 *
 * The enquiry form works and the quote desk works, and between them sat a
 * gap nobody could cross: `orders` is readable by `customer_id = auth.uid()`,
 * and almost nobody who enquires has ever signed in. The shop priced the job
 * and the person who asked found out by being telephoned, if somebody
 * remembered.
 *
 * The shape here is the shape the database function returns, and the two are
 * deliberately narrow: everything the shop would not read out over the phone
 * is absent from both. Parsing it here rather than in the page means the one
 * place that decides what a link shows is next to the one place that decides
 * what it means.
 */

export type TrackLine = {
  qty: number;
  name: string;
  price: number;
  spec: SpecAnswer[];
};

export type TrackProof = {
  version: number;
  imageUrl: string;
  note: string | null;
  sentAt: string;
  decision: "approved" | "changes" | null;
  reply: string | null;
};

export type TrackedByLink = {
  ticket: number | null;
  createdAt: string;
  status: string;
  fulfillment: string;
  scheduledFor: string | null;
  contactName: string | null;
  /** What they asked for, in their own words. */
  notes: string | null;
  revenue: number;
  deliveryFee: number;
  rushFee: number;
  quotedAt: string | null;
  quoteValidUntil: string | null;
  paymentStatus: string;
  paymentPlan: string;
  downpaymentAmount: number;
  cancelledReason: string | null;
  /** True once the order belongs to an account. */
  claimed: boolean;
  lines: TrackLine[];
  proof: TrackProof | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? null : String(v));

/**
 * The function's answer, as something the page can render.
 *
 * Returns null for anything that is not an order — a token that matched
 * nothing comes back as SQL NULL, and a page that treats that as an empty
 * order would tell somebody their job exists and has nothing in it.
 */
export function parseTracked(raw: unknown): TrackedByLink | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!r.status) return null;

  return {
    ticket: r.ticket == null ? null : num(r.ticket),
    createdAt: String(r.created_at ?? ""),
    status: String(r.status),
    fulfillment: String(r.fulfillment ?? "pickup"),
    scheduledFor: str(r.scheduled_for),
    contactName: str(r.contact_name),
    notes: str(r.notes),
    revenue: num(r.revenue),
    deliveryFee: num(r.delivery_fee),
    rushFee: num(r.rush_fee),
    quotedAt: str(r.quoted_at),
    quoteValidUntil: str(r.quote_valid_until),
    paymentStatus: String(r.payment_status ?? "unpaid"),
    paymentPlan: String(r.payment_plan ?? "full"),
    downpaymentAmount: num(r.downpayment_amount),
    cancelledReason: str(r.cancelled_reason),
    claimed: Boolean(r.claimed),
    lines: Array.isArray(r.lines)
      ? r.lines.map((l) => {
          const line = (l ?? {}) as Record<string, unknown>;
          return {
            qty: num(line.qty),
            name: String(line.name ?? "Item"),
            price: num(line.price),
            spec: parseSpec(line.spec),
          };
        })
      : [],
    proof: proofOf(r.proof),
  };
}

function proofOf(raw: unknown): TrackProof | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const imageUrl = String(p.image_url ?? "");
  if (!imageUrl) return null;
  const decision = p.decision === "approved" || p.decision === "changes" ? p.decision : null;
  return {
    version: num(p.version) || 1,
    imageUrl,
    note: str(p.note),
    sentAt: String(p.sent_at ?? ""),
    decision,
    reply: str(p.reply),
  };
}

/**
 * What the order is worth to the customer, including the extras.
 *
 * `revenue` is the goods; the fee and the rush are their own columns so the
 * shop can tell "we sold more" from "we were paid to hurry". A customer is
 * owed one number.
 */
export const trackedTotal = (o: TrackedByLink) =>
  o.revenue + o.deliveryFee + o.rushFee;

/** Whether a price has actually been put on this yet. */
export const isQuoted = (o: TrackedByLink) => o.quotedAt !== null && trackedTotal(o) > 0;

/**
 * A token that could not possibly be one of ours.
 *
 * Checked before the round trip, because a crawler walking `/track/anything`
 * should cost a 404 rather than a database call. The database checks the
 * length again; this one is about not asking.
 */
export const looksLikeToken = (token: string) => /^[a-f0-9]{24,64}$/i.test(token);
