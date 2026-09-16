import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/auth";
import { assetsFrom, CONFIG_ASSETS, type BrandAssets } from "@/lib/brand-assets";

/**
 * The shop's artwork, read once per request.
 *
 * Falls back to the config at every failure — no credentials, no table, no
 * row. A missing logo must never be the reason a page does not render; it is
 * the one asset whose absence the page is already designed to survive.
 */
export const getBrandAssets = cache(async (): Promise<BrandAssets> => {
  if (!isConfigured()) return CONFIG_ASSETS;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shop_settings")
      .select("wordmark_url, wordmark_width, wordmark_height, wordmark_dark_url, wordmark_dark_width, wordmark_dark_height")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return assetsFrom(data as Record<string, unknown> | null);
  } catch {
    return CONFIG_ASSETS;
  }
});
