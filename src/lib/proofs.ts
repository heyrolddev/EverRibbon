/**
 * The photograph a customer approves before anything is made.
 *
 * Pure over rows, so the shop's screen, the customer's screen and a test all
 * agree about what state a proof is in — which matters more here than
 * elsewhere, because the two screens are showing the same fact to people on
 * opposite sides of a payment.
 */

export type ProofDecision = "approved" | "changes";

export type Proof = {
  id: number;
  version: number;
  imageUrl: string;
  /** What the shop asked them to look at. */
  note: string | null;
  sentAt: string;
  decision: ProofDecision | null;
  /** What they said back. Required when the answer is "changes". */
  reply: string | null;
  decidedAt: string | null;
};

/**
 * The one that counts.
 *
 * Highest version, not most recently sent: a shop that re-uploads an older
 * file by mistake has not un-sent the newer one, and "latest" meaning "last
 * touched" would quietly reopen a decision that was already made.
 */
export const currentProof = (proofs: Proof[]): Proof | null =>
  proofs.length === 0
    ? null
    : proofs.reduce((best, p) => (p.version > best.version ? p : best));

/** What the next one would be numbered. */
export const nextVersion = (proofs: Proof[]): number =>
  proofs.reduce((n, p) => Math.max(n, p.version), 0) + 1;

/**
 * Where an order actually stands on its proof, in one word.
 *
 * `none` is not the same as `rework`, and the difference decides what the
 * shop's screen offers: a first proof to send, or a second one.
 */
export type ProofState = "none" | "waiting" | "approved" | "rework";

export function proofState(proofs: Proof[]): ProofState {
  const current = currentProof(proofs);
  if (!current) return "none";
  if (current.decision === "approved") return "approved";
  if (current.decision === "changes") return "rework";
  return "waiting";
}

/** Sent, and nobody has answered. The job is stopped until somebody does. */
export const awaitingDecision = (proofs: Proof[]) => proofState(proofs) === "waiting";

/** The customer said make it. */
export const isApproved = (proofs: Proof[]) => proofState(proofs) === "approved";

/** They asked for something different, so it is the shop's move again. */
export const needsRework = (proofs: Proof[]) => proofState(proofs) === "rework";

/**
 * Everything the customer asked for, oldest first.
 *
 * Shown to whoever is making the thing. Three proofs deep, "what did they
 * want changed" is a question with three answers and only the newest is on
 * screen otherwise — which is how the change requested on version one gets
 * lost by version three.
 */
export const changeRequests = (proofs: Proof[]): { version: number; reply: string }[] =>
  [...proofs]
    .sort((a, b) => a.version - b.version)
    .filter((p) => p.decision === "changes" && p.reply?.trim())
    .map((p) => ({ version: p.version, reply: p.reply!.trim() }));

/** A reply has to say something. Refusing here is kinder than refusing later. */
export const CHANGE_REPLY_MIN = 3;
export const CHANGE_REPLY_MAX = 600;

export function checkReply(reply: string): { ok: true; reply: string } | { ok: false; error: string } {
  const trimmed = reply.trim();
  if (trimmed.length < CHANGE_REPLY_MIN) {
    return { ok: false, error: "Tell us what to change — even a few words helps." };
  }
  if (trimmed.length > CHANGE_REPLY_MAX) {
    return { ok: false, error: `Keep it under ${CHANGE_REPLY_MAX} characters.` };
  }
  return { ok: true, reply: trimmed };
}
