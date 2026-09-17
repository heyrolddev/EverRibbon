import test from "node:test";
import assert from "node:assert/strict";
import {
  RECEIPT_LINK_SECONDS,
  RECEIPT_PREFIX,
  hasReceipt,
  privateBucketOf,
  receiptPath,
  receiptRef,
} from "../src/lib/receipts.ts";

test("the private bucket is derived from the public one, never typed", () => {
  // The public bucket is already named from the config key, because a
  // hardcoded name meant a second deployment wrote into the first shop's
  // bucket. The same mistake is available here and costs more.
  assert.equal(privateBucketOf("everribbon"), "everribbon-private");
  assert.equal(privateBucketOf("pepperpan"), "pepperpan-private");
  assert.notEqual(privateBucketOf("a"), privateBucketOf("b"));
});

test("a row with nothing on it has no receipt", () => {
  assert.equal(receiptRef({}), null);
  assert.equal(receiptRef({ payment_receipt_path: null, payment_receipt_url: null }), null);
  assert.equal(receiptRef({ payment_receipt_path: "   " }), null);
  assert.equal(hasReceipt({}), false);
});

test("a new receipt is a path to be signed", () => {
  const ref = receiptRef({ payment_receipt_path: "receipts/ord_1/abc.jpg" });
  assert.deepEqual(ref, { kind: "private", path: "receipts/ord_1/abc.jpg" });
});

test("an old receipt is still readable, and is not signed", () => {
  // These are the evidence behind payments the shop has already confirmed.
  // Dropping the column would have taken them with it.
  const ref = receiptRef({
    payment_receipt_url: "https://x.supabase.co/storage/v1/object/public/s/receipts/a.jpg",
  });
  assert.equal(ref?.kind, "legacy");
});

test("the private path wins when a row carries both", () => {
  const ref = receiptRef({
    payment_receipt_path: "receipts/ord_1/new.jpg",
    payment_receipt_url: "https://x.test/old.jpg",
  });
  // The newer file is the one the customer meant — and the one that is not
  // world-readable.
  assert.deepEqual(ref, { kind: "private", path: "receipts/ord_1/new.jpg" });
});

test("a URL that turns up in the path column is not handed to the signer", () => {
  // Signing it would come back with a working link to a file that does not
  // exist, whose name is an entire URL — which renders as a broken image
  // rather than as "no receipt", and reads to staff as a customer who never
  // paid.
  for (const url of [
    "https://x.test/old.jpg",
    "http://x.test/old.jpg",
    "HTTPS://X.TEST/old.jpg",
  ]) {
    // On its own it is no receipt at all, which the screens already draw.
    assert.equal(receiptRef({ payment_receipt_path: url }), null, url);
    // And where the legacy column has the same value, that is what is shown.
    assert.deepEqual(
      receiptRef({ payment_receipt_path: url, payment_receipt_url: url }),
      { kind: "legacy", url }
    );
  }
});

test("a receipt is filed under the order it pays for", () => {
  // It used to be keyed on the CUSTOMER's id, in a public bucket — so every
  // screenshot one person had ever sent shared a guessable prefix, and one
  // leaked link was all of their payments rather than one of them.
  const path = receiptPath("ord_1234", "jpg", "fixed-id");
  assert.equal(path, `${RECEIPT_PREFIX}/ord_1234/fixed-id.jpg`);
  assert.ok(path.startsWith(`${RECEIPT_PREFIX}/`));
});

test("two receipts on one order do not overwrite each other", () => {
  // Re-submitting is an ordinary thing: the first screenshot was blurry. The
  // first one is still the evidence for what was sent first.
  const a = receiptPath("ord_1", "jpg");
  const b = receiptPath("ord_1", "jpg");
  assert.notEqual(a, b);
});

test("a signed link outlives a glance and not a group chat", () => {
  assert.ok(RECEIPT_LINK_SECONDS >= 60, "too short to open and read");
  assert.ok(RECEIPT_LINK_SECONDS <= 60 * 60, "long enough to forward");
});
