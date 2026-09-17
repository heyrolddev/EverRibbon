import test from "node:test";
import assert from "node:assert/strict";
import {
  isQuoted,
  looksLikeToken,
  parseTracked,
  trackedTotal,
  type TrackedByLink,
} from "../src/lib/track.ts";

const row = (over: Record<string, unknown> = {}) => ({
  ticket: 42,
  created_at: "2026-09-17T01:00:00Z",
  status: "quoted",
  fulfillment: "pickup",
  scheduled_for: null,
  contact_name: "Krizzia",
  notes: "12-stem bouquet, maroon and gold",
  revenue: 1700,
  delivery_fee: 80,
  rush_fee: 0,
  quoted_at: "2026-09-17T02:00:00Z",
  quote_valid_until: "2026-10-01",
  payment_status: "unpaid",
  payment_plan: "full",
  downpayment_amount: 0,
  cancelled_reason: null,
  claimed: false,
  lines: [
    { qty: 1, name: "12-stem bouquet", price: 1700, spec: { answers: [{ key: "colours", label: "Colours", value: "Maroon + gold" }] } },
  ],
  proof: null,
  ...over,
});

test("a token that matched nothing is nothing, not an empty order", () => {
  // SQL returns NULL for a token nobody holds. A page that read that as an
  // empty order would tell somebody their job exists and has nothing in it.
  for (const raw of [null, undefined, "", 0, [], {}, { ticket: 1 }]) {
    assert.equal(parseTracked(raw), null);
  }
});

test("what the link shows comes back whole", () => {
  const o = parseTracked(row())!;
  assert.equal(o.ticket, 42);
  assert.equal(o.status, "quoted");
  assert.equal(o.contactName, "Krizzia");
  assert.equal(o.lines.length, 1);
  assert.deepEqual(o.lines[0]!.spec, [
    { key: "colours", label: "Colours", value: "Maroon + gold" },
  ]);
});

test("the customer is owed one number, not three columns", () => {
  // Goods, delivery and the rush fee are separate on the shop's side so it
  // can tell "we sold more" from "we were paid to hurry". Nobody being
  // quoted cares about that distinction.
  const o = parseTracked(row({ revenue: 1700, delivery_fee: 80, rush_fee: 170 }))!;
  assert.equal(trackedTotal(o), 1950);
});

test("an enquiry nobody has priced yet is not a quote", () => {
  // The whole reason the link exists: it is sent before there is a price.
  // A ₱0 total shown as "your quote" reads as a job somebody is doing free.
  const asked = parseTracked(row({ quoted_at: null, revenue: 0, delivery_fee: 0 }))!;
  assert.equal(isQuoted(asked), false);
  assert.equal(isQuoted(parseTracked(row())!), true);
  // Quoted-at set but nothing on it is still not a price.
  assert.equal(
    isQuoted(parseTracked(row({ revenue: 0, delivery_fee: 0, rush_fee: 0 }))!),
    false
  );
});

test("a proof comes back only when there is a photograph in it", () => {
  assert.equal(parseTracked(row())!.proof, null);
  assert.equal(parseTracked(row({ proof: { version: 2 } }))!.proof, null);
  const p = parseTracked(
    row({ proof: { version: 2, image_url: "https://x/p.jpg", decision: "changes", reply: "Too dark" } })
  )!.proof;
  assert.equal(p?.version, 2);
  assert.equal(p?.decision, "changes");
  // Anything that is not one of the two answers is no answer.
  assert.equal(
    parseTracked(row({ proof: { image_url: "https://x/p.jpg", decision: "maybe" } }))!.proof?.decision,
    null
  );
});

test("a number that is not a number does not become NaN on the page", () => {
  const o = parseTracked(row({ revenue: "nonsense", delivery_fee: null }))!;
  assert.equal(trackedTotal(o), 0);
  assert.ok(!Number.isNaN(trackedTotal(o)));
});

test("a token of the wrong shape never reaches the database", () => {
  // A crawler walking /track/anything should cost a 404, not a round trip.
  assert.ok(looksLikeToken("a".repeat(32)));
  assert.ok(looksLikeToken("0123456789abcdef0123456789abcdef"));
  for (const bad of ["", "short", "../../etc", "a".repeat(23), "a".repeat(65), "zz".repeat(16)]) {
    assert.equal(looksLikeToken(bad), false, bad);
  }
});

test("claimed says whether the page offers to hand it over", () => {
  assert.equal(parseTracked(row({ claimed: true }))!.claimed, true);
  assert.equal(parseTracked(row())!.claimed, false);
});

test("a cancelled order still says why", () => {
  const o: TrackedByLink = parseTracked(
    row({ status: "cancelled", cancelled_reason: "Ran out of the maroon" })
  )!;
  assert.equal(o.cancelledReason, "Ran out of the maroon");
});
