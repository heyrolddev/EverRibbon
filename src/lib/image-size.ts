/**
 * How big an image is, read from its own first few bytes.
 *
 * Every image format writes its dimensions into a header near the front of
 * the file, so this needs a few dozen bytes rather than the whole picture —
 * and it needs no image library, no canvas and no browser.
 *
 * It exists because of a question nobody should have to answer. Storing a
 * logo without its pixel size means the page cannot reserve its space, so the
 * header jumps as it loads. Asking the owner for the number means asking them
 * to right-click a file and read a properties panel, and the first answer
 * back was "just use the other shop's numbers" — which would be a different
 * aspect ratio, and the whole point of the number is the aspect ratio.
 *
 * So nobody is asked. The file says.
 *
 * Pure over bytes, so every format below is checked against a real header
 * rather than against whatever the last upload happened to be.
 */

export type ImageSize = { width: number; height: number };

/** Enough for every header here; WEBP's VP8X needs 30. */
export const HEADER_BYTES = 64;

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => ((b[i + 1] ?? 0) << 8) | (b[i] ?? 0);
const u24le = (b: Uint8Array, i: number) =>
  (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
// Unsigned, explicitly. `<<` in JavaScript yields a SIGNED 32-bit integer, so
// a value with the top bit set comes back negative — and PNG's own signature,
// 0x89504E47, has the top bit set. Without the `>>> 0` this function reports
// every PNG as something else and the parser silently falls through to the
// next format.
const u32be = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;

const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...Array.from(b.slice(i, i + n)));

const ok = (s: ImageSize): ImageSize | null =>
  s.width > 0 && s.height > 0 ? s : null;

/**
 * PNG: an 8-byte signature, then IHDR, whose first two fields are the size.
 * Fixed offsets — IHDR is required to be the first chunk.
 */
function png(b: Uint8Array): ImageSize | null {
  if (b.length < 24) return null;
  if (u32be(b, 0) !== 0x89504e47) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return ok({ width: u32be(b, 16), height: u32be(b, 20) });
}

/** GIF: "GIF87a" or "GIF89a", then the logical screen size, little-endian. */
function gif(b: Uint8Array): ImageSize | null {
  if (b.length < 10) return null;
  const sig = ascii(b, 0, 6);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  return ok({ width: u16le(b, 6), height: u16le(b, 8) });
}

/**
 * WEBP: a RIFF container whose payload says which of three encodings it is.
 *
 * All three are in the wild. An exporter picks whichever is smaller for the
 * picture, so a shop that re-exports its logo can silently change which of
 * these branches runs.
 */
function webp(b: Uint8Array): ImageSize | null {
  if (b.length < 30) return null;
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;

  const kind = ascii(b, 12, 4);

  // Extended: the canvas size, stored as size-1 in 24 bits.
  if (kind === "VP8X") {
    return ok({ width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 });
  }

  // Lossy: a 3-byte start code, then 14 bits each.
  if (kind === "VP8 ") {
    if (!(b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)) return null;
    return ok({ width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff });
  }

  // Lossless: a signature byte, then 14 bits each, packed across bytes.
  if (kind === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits =
      ((b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)) >>> 0;
    return ok({
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    });
  }

  return null;
}

/**
 * JPEG: no fixed offset. The size lives in a "start of frame" marker, which
 * sits after however many other markers the encoder wrote first — so the
 * segments have to be walked.
 *
 * `limit` is the bytes actually available. A JPEG whose frame header is
 * further in than that returns null rather than a wrong answer, and the
 * caller fetches more.
 */
function jpeg(b: Uint8Array, limit = b.length): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < limit) {
    if (b[i] !== 0xff) {
      i++; // Padding between segments is legal; walk past it.
      continue;
    }
    const marker = b[i + 1] ?? 0;
    // SOF0-SOF15, minus the three that are not frame headers at all.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return ok({ width: u16be(b, i + 7), height: u16be(b, i + 5) });
    }
    // Standalone markers carry no length field to skip by.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null; // Malformed; walking further would loop.
    i += 2 + length;
  }
  return null;
}

/**
 * The size, or null for anything not recognised.
 *
 * Null rather than a throw or a guess: a logo whose size cannot be read still
 * renders, it just cannot have its space reserved. That is a smaller problem
 * than refusing the upload, and a much smaller one than inventing a ratio and
 * drawing the shop's mark squashed.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  return png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes);
}
