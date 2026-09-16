import test from "node:test";
import assert from "node:assert/strict";
import {
  changeRequests,
  checkReply,
  currentProof,
  nextVersion,
  proofState,
  type Proof,
} from "../src/lib/proofs.ts";
import {
  proofStep,
  stepAfter,
  stepBackToShop,
  FALLBACK_STATUSES,
} from "../src/lib/order-statuses.ts";
import { RIBBON } from "./fixtures/statuses.ts";

const proof = (over: Partial<Proof> = {}): Proof => ({
  id: 1,
  version: 1,
  imageUrl: "https://example.test/proof.jpg",
  note: null,
  sentAt: "2026-09-16T01:00:00Z",
  decision: null,
  reply: null,
  decidedAt: null,
  ...over,
});

test("no proof is not the same as a rejected one", () => {
  // The difference decides what the shop's screen offers: a first proof to
  // send, or a second.
  assert.equal(proofState([]), "none");
  assert.equal(proofState([proof({ decision: "changes", reply: "Too dark" })]), "rework");
});

test("a sent proof stops the job until somebody answers", () => {
  assert.equal(proofState([proof()]), "waiting");
});

test("the one that counts is the highest version, not the last touched", () => {
  /*
   * A shop that re-uploads an older file by mistake has not un-sent the newer
   * one. "Latest" meaning "most recently written" would quietly reopen a
   * decision that had already been made.
   */
  const proofs = [
    proof({ id: 2, version: 2 }),
    proof({ id: 1, version: 1, decision: "changes", reply: "Too dark" }),
  ];
  assert.equal(currentProof(proofs)?.version, 2);
  assert.equal(proofState(proofs), "waiting");
});

test("approving the newest is what approves the order", () => {
  const proofs = [
    proof({ id: 1, version: 1, decision: "changes", reply: "Too dark" }),
    proof({ id: 2, version: 2, decision: "approved", decidedAt: "2026-09-16T02:00:00Z" }),
  ];
  assert.equal(proofState(proofs), "approved");
});

test("versions count up from what is already there", () => {
  assert.equal(nextVersion([]), 1);
  assert.equal(nextVersion([proof({ version: 1 }), proof({ id: 2, version: 2 })]), 3);
  // Gaps do not reset it — a deleted attempt still happened.
  assert.equal(nextVersion([proof({ version: 5 })]), 6);
});

test("every change ever asked for is kept, oldest first", () => {
  // Three proofs deep, "what did they want changed" has three answers, and
  // only the newest is on screen otherwise. That is how the change asked for
  // on version one gets lost by version three.
  const proofs = [
    proof({ id: 3, version: 3 }),
    proof({ id: 1, version: 1, decision: "changes", reply: "Too dark" }),
    proof({ id: 2, version: 2, decision: "changes", reply: "Name spelled wrong" }),
  ];
  assert.deepEqual(changeRequests(proofs), [
    { version: 1, reply: "Too dark" },
    { version: 2, reply: "Name spelled wrong" },
  ]);
});

test("an approval is not a change request", () => {
  assert.deepEqual(changeRequests([proof({ decision: "approved" })]), []);
});

test("asking for changes has to say what to change", () => {
  assert.equal(checkReply("  ").ok, false);
  assert.equal(checkReply("no").ok, false);
  const ok = checkReply("  Make the maroon darker  ");
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.reply, "Make the maroon darker", "trimmed before storing");
  assert.equal(checkReply("x".repeat(601)).ok, false);
});

test("a change request hands the job back to the shop's own step", () => {
  /*
   * Not a named step. On this shop's rail the step before "proof sent" is
   * "deposit paid" — where work can start — and on another shop's list it
   * will be something else entirely.
   */
  assert.equal(stepBackToShop(RIBBON, "proof_sent"), "deposit_paid");
});

test("stepping back never lands on a step that waits for the customer", () => {
  const back = stepBackToShop(RIBBON, "proof_sent");
  const step = RIBBON.find((r) => r.key === back);
  assert.equal(step?.awaitingCustomer, false, "handing it back to them again is a loop");
  assert.equal(step?.isOpen, true);
});

test("a step with nothing behind it stays where it is", () => {
  // Better a stuck order than one that jumps somewhere nobody chose.
  assert.equal(stepBackToShop(RIBBON, "inquiry"), "inquiry");
  assert.equal(stepBackToShop(RIBBON, "not_a_step"), "not_a_step");
});

test("the proof step is the last gate that waits on the customer", () => {
  /*
   * "Agreed, waiting on the deposit" is also a gate that waits on them. The
   * proof is the one furthest along the rail, so the rule is the last, not
   * the first — and "first" would have moved every proof onto the deposit
   * step, where a job that is already paid for would look unpaid.
   */
  assert.equal(proofStep(RIBBON)?.key, "proof_sent");
});

test("a shop that does not send proofs has no proof step", () => {
  // A kitchen does not photograph your noodles for approval. The panel then
  // does not appear at all, rather than appearing and doing nothing.
  assert.equal(proofStep(FALLBACK_STATUSES), null);
});

test("an approved proof moves the order one step along its own rail", () => {
  assert.equal(stepAfter(RIBBON, "proof_sent"), "in_production");
});

test("nothing advances past the end of the rail", () => {
  assert.equal(stepAfter(RIBBON, "delivered"), null);
  assert.equal(stepAfter(RIBBON, "not_a_step"), null);
});
