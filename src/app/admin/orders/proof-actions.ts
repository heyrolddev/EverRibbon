"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getViewer } from "@/lib/auth";
import { checkMedia, IMAGE_TYPES, MEDIA_BUCKET } from "@/lib/media";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { proofStep } from "@/lib/order-statuses";
import { nextVersion, type Proof } from "@/lib/proofs";

/**
 * Sending a proof.
 *
 * Two steps, like every other upload here: the server says who may upload and
 * where it lands, then the bytes go from the phone straight to storage. What
 * is different is what happens after — sending a proof moves the order, and
 * the step it moves to is the shop's own, not a name written here.
 */

/** Proofs keep their own folder, away from product photographs. */
const PROOF_PREFIX = "proofs";

export type Signed =
  | { ok: true; path: string; token: string; url: string }
  | { ok: false; error: string };

export async function signProofUpload(input: {
  orderId: string;
  type: string;
  size: number;
}): Promise<Signed> {
  if (!can(await getViewer(), "orders")) {
    return { ok: false, error: "You can't send proofs." };
  }
  if (!IMAGE_TYPES[input.type]) {
    return { ok: false, error: "A proof has to be a photo — JPG, PNG or WEBP." };
  }
  const checked = checkMedia(input.type, input.size);
  if (!checked.ok) return { ok: false, error: checked.error };

  const supabase = createAdminClient();
  // The order id is in the path, so a proof that turns up in the wrong place
  // is traceable rather than anonymous.
  const path = `${PROOF_PREFIX}/${input.orderId}/${crypto.randomUUID()}.${checked.ext}`;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: `Could not start the upload: ${error?.message ?? "no token"}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, path, token: data.token, url: publicUrl };
}

/**
 * Record the proof and move the order to the step that means "with them".
 *
 * The status change is the point. A proof sitting in storage that the board
 * still shows as "in production" is a job two people each think the other is
 * doing.
 */
export async function sendProof(input: {
  orderId: string;
  imageUrl: string;
  note: string;
}): Promise<{ ok: true; proof: Proof } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!can(viewer, "orders")) return { ok: false, error: "You can't send proofs." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("order_proofs")
    .select("version")
    .eq("order_id", input.orderId);

  const version = nextVersion(
    ((existing ?? []) as { version: number }[]).map((r) => ({ version: Number(r.version) }) as Proof)
  );

  const { data, error } = await supabase
    .from("order_proofs")
    .insert({
      order_id: input.orderId,
      version,
      image_url: input.imageUrl,
      note: input.note.trim() || null,
      sent_by: viewer?.profile?.id ?? null,
    })
    .select("id, version, image_url, note, sent_at, decision, reply, decided_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message.includes("order_proofs")
        ? "Run migration 0019 in the Supabase SQL editor first."
        : (error?.message ?? "The proof could not be saved."),
    };
  }

  // Whichever step this shop calls "with the customer, nothing is made yet".
  // Asked of the steps rather than named here, so a shop that calls it
  // something else still gets its order moved — and a shop with no such step
  // gets no move, which is right, because it does not send proofs.
  const statuses = await getOrderStatuses();
  const step = proofStep(statuses);
  if (step) {
    await supabase.from("orders").update({ status: step.key }).eq("id", input.orderId);
  }

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  return {
    ok: true,
    proof: {
      id: Number(data.id),
      version: Number(data.version),
      imageUrl: String(data.image_url),
      note: data.note == null ? null : String(data.note),
      sentAt: String(data.sent_at),
      decision: null,
      reply: null,
      decidedAt: null,
    },
  };
}
