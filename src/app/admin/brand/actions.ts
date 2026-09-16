"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getViewer } from "@/lib/auth";
import { checkMedia, IMAGE_TYPES, MEDIA_BUCKET } from "@/lib/media";
import { assetsFrom, type BrandAssets } from "@/lib/brand-assets";

/**
 * The shop's own artwork, uploaded by the shop.
 *
 * Same two-step shape as the promo media field: the server says who may
 * upload and where it lands and hands back a token for that one path, then
 * the bytes go from the browser straight to storage. Nothing large passes
 * through a server action, which exists to carry JSON.
 *
 * The dimensions arrive with the save rather than being measured here. The
 * browser has already decoded the image by then and knows them exactly;
 * reading them on this side would mean fetching back the file we just sent.
 */

/** Its own folder, so a tidy-up of product photos never catches the logo. */
const BRAND_PREFIX = "brand";

type Signed =
  | { ok: true; path: string; token: string; url: string }
  | { ok: false; error: string };

async function mayEdit() {
  return can(await getViewer(), "settings");
}

export async function signWordmarkUpload(input: {
  type: string;
  size: number;
}): Promise<Signed> {
  if (!(await mayEdit())) {
    return { ok: false, error: "Only the owner can change the shop's logo." };
  }

  // A logo is a still image. A video would pass `checkMedia` and then render
  // as a broken <img> in the header of every page.
  if (!IMAGE_TYPES[input.type]) {
    return { ok: false, error: "A logo has to be a PNG, JPG, WEBP or GIF." };
  }
  const checked = checkMedia(input.type, input.size);
  if (!checked.ok) return { ok: false, error: checked.error };

  const supabase = createAdminClient();
  const path = `${BRAND_PREFIX}/${crypto.randomUUID()}.${checked.ext}`;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return {
      ok: false,
      error: `Could not start the upload: ${error?.message ?? "no token came back"}`,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  return { ok: true, path, token: data.token, url: publicUrl };
}

export type WordmarkInput = {
  /** Which ground this mark is drawn for. */
  ground: "light" | "dark";
  /** Null clears it — the light mark falls back to the config, the dark to the light. */
  url: string | null;
  width: number | null;
  height: number | null;
};

export async function saveWordmark(
  input: WordmarkInput
): Promise<{ ok: true; assets: BrandAssets } | { ok: false; error: string }> {
  if (!(await mayEdit())) {
    return { ok: false, error: "Only the owner can change the shop's logo." };
  }

  const url = input.url?.trim() || null;
  const w = Number(input.width);
  const h = Number(input.height);

  // The database says the same thing, and says it last. This is here so the
  // owner gets a sentence rather than a constraint name.
  if (url && !(w > 0 && h > 0)) {
    return { ok: false, error: "That image did not report a size. Try another file." };
  }

  const prefix = input.ground === "dark" ? "wordmark_dark" : "wordmark";
  const patch = {
    [`${prefix}_url`]: url,
    [`${prefix}_width`]: url ? Math.round(w) : null,
    [`${prefix}_height`]: url ? Math.round(h) : null,
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .update(patch)
    .eq("id", 1)
    .select("wordmark_url, wordmark_width, wordmark_height, wordmark_dark_url, wordmark_dark_width, wordmark_dark_height")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message.includes("column")
        ? "Run migration 0015 in the Supabase SQL editor first."
        : error.message,
    };
  }

  // Every page draws the mark, so every page is now stale.
  revalidatePath("/", "layout");
  return { ok: true, assets: assetsFrom(data as Record<string, unknown> | null) };
}
