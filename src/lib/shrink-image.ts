import { AVATAR_EDGE } from "@/lib/media";

/**
 * Square and shrink a photo in the browser, before it is uploaded.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The shop's brief was "add a size limit so the site doesn't get big or
 * slow". A limit alone would do that, and would also be the worst possible
 * answer for the person holding the phone: they pick the photo they have,
 * are told it is 4.2MB, and are now expected to go and find an image
 * resizer. Most of them simply won't have a profile picture.
 *
 * The size of a profile picture is not a decision a customer should have to
 * make. It is shown as a circle a centimetre across. So the photo is squared,
 * scaled to {@link AVATAR_EDGE} and re-encoded here — a 6MB camera photo
 * leaves the phone at around 40KB, every time, whatever it started as. The
 * limits in `media.ts` then sit behind this as backstops, not as walls, and
 * the upload is quick on the kind of connection a stall's customers use.
 *
 * THREE DETAILS THAT ARE EASY TO GET WRONG
 *
 * `imageOrientation: "from-image"` — `createImageBitmap` ignores EXIF
 * rotation by default, and phone cameras lean on it heavily. Without this,
 * a portrait photo taken on an iPhone arrives on its side, and it looks like
 * the site rotated it.
 *
 * The white fill — the result may be encoded as JPEG, which has no alpha
 * channel. Drawing a transparent PNG onto an untouched canvas and encoding
 * it as JPEG gives you a black square. White is also what the circle sits on
 * in most places it appears.
 *
 * Never upscaling — a 96px picture stays 96px. Blowing it up to 512 makes
 * the file eight times bigger and the photo no clearer.
 */

export type Shrunk = { blob: Blob; type: string };

/** WEBP is a third the size of JPEG at the same quality; JPEG is the fallback. */
const QUALITY = 0.86;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  // Older Safari. An <img> applies EXIF orientation by itself, so there is
  // nothing to ask for here.
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That file isn't a photo this browser can read."));
      img.src = url;
    });
  } finally {
    // Safe to revoke once decoding has finished either way — the bitmap is
    // already in memory, and a rejection has nothing left to load.
    URL.revokeObjectURL(url);
  }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Draw a decoded photo into a canvas of a given size and encode it.
 *
 * The shared half of both shrinks. The crop rectangle is the caller's
 * decision; everything below it — the white mat, the smoothing, and trusting
 * the type that comes back over the one asked for — is the same either way
 * and was worth writing once.
 */
async function render(
  source: ImageBitmap | HTMLImageElement,
  crop: { x: number; y: number; w: number; h: number },
  out: { w: number; h: number },
  quality: number
): Promise<Shrunk> {
  const canvas = document.createElement("canvas");
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser wouldn't let us resize the photo.");

  // The mat a transparent PNG is flattened onto, so a JPEG does not come
  // out with a black background. Not a theme colour: it is what "no
  // transparency" means in a photograph.
  ctx.fillStyle = "#ffffff"; // brand-literal-ok
  ctx.fillRect(0, 0, out.w, out.h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, out.w, out.h);

  // A canvas asked for a format it cannot write returns PNG without saying
  // so, which is why the type that comes back is trusted over the one asked
  // for.
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, type: webp.type };

  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (jpeg) return { blob: jpeg, type: jpeg.type || "image/jpeg" };

  throw new Error("Couldn't prepare that photo. Try a different one.");
}

const sizeOf = (source: ImageBitmap | HTMLImageElement) => ({
  width: "naturalWidth" in source ? source.naturalWidth : source.width,
  height: "naturalHeight" in source ? source.naturalHeight : source.height,
});

export async function squareShrink(file: File, edge = AVATAR_EDGE): Promise<Shrunk> {
  const source = await decode(file);
  const { width, height } = sizeOf(source);

  try {
    if (!width || !height) {
      throw new Error("That photo came out empty. Try another one.");
    }

    // Centre crop to a square, then scale down — never up.
    const side = Math.min(width, height);
    const out = Math.min(edge, side);

    return await render(
      source,
      { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side },
      { w: out, h: out },
      QUALITY
    );
  } finally {
    if ("close" in source) source.close();
  }
}

/**
 * Shrink a photo to fit inside a box, keeping its shape.
 *
 * For a photo somebody is sending as an example of what they want — where
 * cropping it to a square is the one thing that must not happen. Half the
 * point of "ganito po ang gusto ko" is usually the part that a square would
 * cut off: the length of a sash, the shape of a bouquet.
 *
 * Still shrunk, and hard. A reference photo is looked at once, by one person,
 * on a phone — and the alternative is asking somebody on a prepaid connection
 * to send four megabytes before they have been quoted a price.
 */
export async function fitShrink(
  file: File,
  maxEdge: number,
  quality = QUALITY
): Promise<Shrunk> {
  const source = await decode(file);
  const { width, height } = sizeOf(source);

  try {
    if (!width || !height) {
      throw new Error("That photo came out empty. Try another one.");
    }
    // Never upscaling: a small photo stays small. Blowing it up makes the
    // file bigger and the photo no clearer.
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return await render(
      source,
      { x: 0, y: 0, w: width, h: height },
      { w: Math.round(width * scale), h: Math.round(height * scale) },
      quality
    );
  } finally {
    if ("close" in source) source.close();
  }
}
