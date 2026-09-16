import test from "node:test";
import assert from "node:assert/strict";
import { imageSize, HEADER_BYTES } from "../src/lib/image-size.ts";

/**
 * Headers built by hand to the spec, so a change to the parser breaks against
 * the format rather than against a file that happened to be lying around.
 */

const bytes = (...parts: (number | number[] | string)[]): Uint8Array => {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") out.push(...[...p].map((c) => c.charCodeAt(0)));
    else if (Array.isArray(p)) out.push(...p);
    else out.push(p);
  }
  return new Uint8Array(out);
};
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

test("PNG", () => {
  // Signature, IHDR length, "IHDR", width, height.
  const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(1200), be32(400));
  assert.deepEqual(imageSize(png), { width: 1200, height: 400 });
});

test("PNG: a square mark reads square, not as the last shop's ratio", () => {
  // The case that prompted this: "just copy the other logo's sizes" would
  // have declared a 2.92:1 box for a 1:1 mark.
  const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(500), be32(500));
  assert.deepEqual(imageSize(png), { width: 500, height: 500 });
});

test("GIF", () => {
  assert.deepEqual(imageSize(bytes("GIF89a", le16(640), le16(480))), { width: 640, height: 480 });
  assert.deepEqual(imageSize(bytes("GIF87a", le16(16), le16(16))), { width: 16, height: 16 });
});

test("WEBP, extended", () => {
  const w = bytes("RIFF", be32(0), "WEBP", "VP8X", [0, 0, 0, 0, 0, 0, 0, 0],
                  le24(1199), le24(399));
  assert.deepEqual(imageSize(w), { width: 1200, height: 400 });
});

test("WEBP, lossy", () => {
  const w = bytes("RIFF", be32(0), "WEBP", "VP8 ", be32(0),
                  [0, 0, 0], [0x9d, 0x01, 0x2a], le16(800), le16(600), [0, 0]);
  assert.deepEqual(imageSize(w), { width: 800, height: 600 });
});

test("WEBP, lossless", () => {
  // 14 bits width-1 then 14 bits height-1, packed little-endian.
  const packed = (255 - 1) | ((128 - 1) << 14);
  const w = bytes("RIFF", be32(0), "WEBP", "VP8L", be32(0), [0x2f],
                  [packed & 255, (packed >>> 8) & 255, (packed >>> 16) & 255, (packed >>> 24) & 255],
                  new Array(10).fill(0));
  assert.deepEqual(imageSize(w), { width: 255, height: 128 });
});

test("JPEG: the frame header is found by walking, not by offset", () => {
  // SOI, then an APP0 segment of 16 bytes, then SOF0.
  const jpg = bytes(
    [0xff, 0xd8],
    [0xff, 0xe0], be16(16), new Array(14).fill(0),
    [0xff, 0xc0], be16(17), [8], be16(300), be16(900), new Array(10).fill(0)
  );
  assert.deepEqual(imageSize(jpg), { width: 900, height: 300 });
});

test("JPEG: progressive frames are read too", () => {
  const jpg = bytes([0xff, 0xd8], [0xff, 0xc2], be16(17), [8], be16(64), be16(48), new Array(10).fill(0));
  assert.deepEqual(imageSize(jpg), { width: 48, height: 64 });
});

test("JPEG: a Huffman table is not a frame header", () => {
  // 0xC4 sits inside the SOF range and is not one. Reading it as a frame
  // would return the table's contents as a picture size.
  const jpg = bytes(
    [0xff, 0xd8],
    [0xff, 0xc4], be16(6), [1, 2, 3, 4],
    [0xff, 0xc0], be16(17), [8], be16(120), be16(240), new Array(10).fill(0)
  );
  assert.deepEqual(imageSize(jpg), { width: 240, height: 120 });
});

test("anything unrecognised is null, never a guess", () => {
  assert.equal(imageSize(new Uint8Array(0)), null);
  assert.equal(imageSize(bytes("not an image at all")), null);
  assert.equal(imageSize(bytes("%PDF-1.7", new Array(40).fill(0))), null);
});

test("a truncated header is null rather than a partial number", () => {
  // Half a PNG header would otherwise read the height as whatever came next.
  assert.equal(imageSize(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])), null);
});

test("a zero dimension is not a size", () => {
  const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(0), be32(400));
  assert.equal(imageSize(png), null);
});

test("a malformed JPEG segment length does not loop forever", () => {
  // A length below 2 would leave the cursor where it was.
  const jpg = bytes([0xff, 0xd8], [0xff, 0xe0], be16(0), new Array(40).fill(0));
  assert.equal(imageSize(jpg), null);
});

test("the header budget covers every format here", () => {
  // WEBP's extended header reaches byte 30, which is the furthest of them.
  assert.ok(HEADER_BYTES >= 30);
});
