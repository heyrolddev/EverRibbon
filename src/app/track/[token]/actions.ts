"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { looksLikeToken } from "@/lib/track";

/**
 * Taking ownership of an order you were sent a link to.
 *
 * The link is read-only on its own, which is right for a stranger holding a
 * URL — but it is a dead end at exactly the moment it matters. Approving a
 * proof and paying a deposit both already work perfectly for somebody with an
 * account, and not at all for somebody without one. Signing in and claiming
 * is the shortest path from "here is your price" to "yes, make it".
 *
 * The check that matters is in the database: only an unowned order, only by
 * somebody signed in. An order that already belongs to an account cannot be
 * taken from it by anyone holding an old link.
 */
export async function claimOrder(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!looksLikeToken(token)) return { ok: false, error: "That link doesn't look right." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in first and the order will come with you." };
  }

  const { data, error } = await supabase.rpc("claim_order", { p_token: token });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("claim_order")
        ? "Run migration 0023 in the Supabase SQL editor first."
        : error.message,
    };
  }
  if (!data) {
    return { ok: false, error: "This order already belongs to an account." };
  }

  revalidatePath(`/track/${token}`);
  revalidatePath("/orders");
  return { ok: true };
}
