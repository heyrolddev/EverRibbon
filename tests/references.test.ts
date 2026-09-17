import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REFERENCES,
  MAX_REFERENCE_BYTES,
  REFERENCE_EDGE,
  REFERENCE_PREFIX,
  REFERENCE_LINK_SECONDS,
  referencePath,
  referencePaths,
} from "../src/lib/references.ts";
import { MAX_IMAGE_BYTES } from "../src/lib/media.ts";

test("nothing in the column is no photographs, not a crash", () => {
  // Same tolerance the spec parser needs, for the same reason: a row
  // somebody edited by hand must render the order rather than take the
  // board down.
  for (const raw of [null, undefined, "", 0, {}, "references/a.jpg"]) {
    assert.deepEqual(referencePaths(raw), []);
  }
  assert.deepEqual(referencePaths([]), []);
});

test("paths come back cleaned, once each, in order", () => {
  assert.deepEqual(
    referencePaths(["references/o1/a.jpg", "  references/o1/b.jpg  ", "references/o1/a.jpg"]),
    ["references/o1/a.jpg", "references/o1/b.jpg"]
  );
});

test("a URL in the column is not handed to the signer", () => {
  // Signing one returns a working link to a file whose name is an entire
  // URL, which renders as a broken frame — and a broken frame on an order
  // card reads as something the shop lost.
  assert.deepEqual(referencePaths(["https://x.test/a.jpg", "HTTP://x.test/b.jpg"]), []);
});

test("a path cannot climb out of its folder", () => {
  assert.deepEqual(referencePaths(["references/../receipts/ord_1/a.jpg"]), []);
});

test("the cap holds however many arrive", () => {
  // The column has the same ceiling, because the form that writes it is open
  // to anyone on the internet and writes with the service-role client —
  // exactly where "the browser only sends three" stops being true.
  const many = Array.from({ length: 40 }, (_, i) => `references/o1/${i}.jpg`);
  assert.equal(referencePaths(many).length, MAX_REFERENCES);
});

test("a photograph is filed under the order it belongs to", () => {
  const path = referencePath("ord_99", "webp", "fixed");
  assert.equal(path, `${REFERENCE_PREFIX}/ord_99/fixed.webp`);
  // And two in a row do not overwrite each other.
  assert.notEqual(referencePath("ord_99", "jpg"), referencePath("ord_99", "jpg"));
});

test("what the browser sends is far below what the server will take", () => {
  /*
   * The shrink is the point, not the limit. A 4MB camera photo leaves the
   * phone at a couple of hundred kilobytes, so the ceiling below is a
   * backstop — reaching it means something went wrong rather than that
   * somebody's photo was big.
   *
   * And three of them have to fit in one request beside the rest of the
   * form, which is what the server-action body limit is set from.
   */
  assert.ok(MAX_REFERENCE_BYTES < MAX_IMAGE_BYTES);
  assert.ok(MAX_REFERENCES * MAX_REFERENCE_BYTES < MAX_IMAGE_BYTES * 3);
  // Big enough to read the spelling on somebody else's sash, small enough
  // to send on a prepaid connection.
  assert.ok(REFERENCE_EDGE >= 1000 && REFERENCE_EDGE <= 2000);
});

test("a link outlives looking at a photograph and pricing the job", () => {
  // Longer than a receipt's: this one is open while somebody works out a
  // price, not glanced at against the GCash app.
  assert.ok(REFERENCE_LINK_SECONDS >= 10 * 60);
  assert.ok(REFERENCE_LINK_SECONDS <= 2 * 60 * 60);
});
