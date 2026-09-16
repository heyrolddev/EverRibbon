import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/auth";
import {
  assetsFrom,
  CONFIG_ASSETS,
  needsMeasuring,
  type BrandAssets,
  type Wordmark,
} from "@/lib/brand-assets";
import { HEADER_BYTES, imageSize, type ImageSize } from "@/lib/image-size";

/**
 * The shop's artwork, read once per request — and measured if nobody has.
 *
 * Falls back to the config at every failure: no credentials, no table, no
 * row, no network. A missing logo must never be the reason a page does not
 * render; it is the one asset whose absence the page is already designed to
 * survive.
 */

/**
 * How big the file at a URL is, from its own header.
 *
 * A ranged request, so this reads sixty-four bytes rather than a megabyte —
 * and falls back to a normal GET for a host that ignores `Range`, which
 * plenty do. Either way the body is truncated to the header before parsing.
 *
 * Failure is null, never a throw and never a guess. Rendering a mark at a
 * ratio nobody measured is the outcome this whole path exists to avoid.
 */
export async function measureRemote(url: string): Promise<ImageSize | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      // The artwork changes when somebody uploads new artwork, and that path
      // writes the size itself. Nothing here needs to be fresh.
      cache: "force-cache",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return imageSize(buf.subarray(0, HEADER_BYTES));
  } catch {
    return null;
  }
}

/**
 * Fill in a size the owner never had to type.
 *
 * Written back with the service-role client because this runs while rendering
 * a page for whoever is looking — usually nobody signed in — and a shop's
 * settings are not theirs to write. A failed write is not an error: the mark
 * renders from its own file either way, and the next render tries again.
 */
async function measureAndStore(
  mark: Wordmark,
  column: "wordmark" | "wordmark_dark"
): Promise<Wordmark> {
  const size = await measureRemote(mark.src);
  if (!size) return mark;

  try {
    await createAdminClient()
      .from("shop_settings")
      .update({
        [`${column}_width`]: size.width,
        [`${column}_height`]: size.height,
      })
      .eq("id", 1)
      // Only if the URL is still the one that was measured. Two renders can
      // race, and an upload can land between the read and the write — this
      // makes the loser a no-op rather than a size stamped on a new file.
      .eq(`${column}_url`, mark.src);
  } catch {
    // Reported by the next render having to do it again, which is cheap.
  }

  return { ...mark, ...size };
}

export const getBrandAssets = cache(async (): Promise<BrandAssets> => {
  // A clone with no credentials yet has no client to make. That is the state
  // every new shop starts in.
  if (!isConfigured()) return CONFIG_ASSETS;

  let assets: BrandAssets;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shop_settings")
      .select("wordmark_url, wordmark_width, wordmark_height, wordmark_dark_url, wordmark_dark_width, wordmark_dark_height")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    assets = assetsFrom(data as Record<string, unknown> | null);
  } catch {
    return CONFIG_ASSETS;
  }

  // A URL somebody pasted, whose file has not been looked at. Measured here,
  // once, rather than asked of the owner — the first answer to "what size is
  // your logo" was "use the other shop's numbers", which is a different
  // aspect ratio, and the number IS the aspect ratio.
  const [light, dark] = await Promise.all([
    needsMeasuring(assets.light)
      ? measureAndStore(assets.light as Wordmark, "wordmark")
      : Promise.resolve(assets.light),
    needsMeasuring(assets.dark)
      ? measureAndStore(assets.dark as Wordmark, "wordmark_dark")
      : Promise.resolve(assets.dark),
  ]);

  return { light, dark };
});
