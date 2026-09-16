"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkMedia, IMAGE_TYPES, MEDIA_BUCKET } from "@/lib/media";
import { formatDateTime } from "@/lib/format";
import { sendProof, signProofUpload } from "@/app/admin/orders/proof-actions";
import { changeRequests, currentProof, proofState, type Proof } from "@/lib/proofs";

/**
 * Sending a customer a photograph to approve, from the order board.
 *
 * On the card rather than behind a screen of its own, because the moment a
 * proof is worth sending is the moment somebody is already looking at the
 * order — and a step that needs navigating to is a step that gets done in
 * Messenger instead, where the approval stops being a record.
 *
 * What the customer asked for last time is shown above the button, because
 * whoever is about to re-shoot the photograph is the person who needs it.
 */
export function ProofSender({
  orderId,
  proofs: initial,
}: {
  orderId: string;
  proofs: Proof[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [proofs, setProofs] = useState(initial);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const state = proofState(proofs);
  const current = currentProof(proofs);
  const asked = changeRequests(proofs);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!IMAGE_TYPES[file.type]) {
      if (input.current) input.current.value = "";
      return setError("A proof has to be a photo — JPG, PNG or WEBP.");
    }
    const checked = checkMedia(file.type, file.size);
    if (!checked.ok) {
      if (input.current) input.current.value = "";
      return setError(checked.error);
    }

    start(async () => {
      const signed = await signProofUpload({ orderId, type: file.type, size: file.size });
      if (!signed.ok) {
        if (input.current) input.current.value = "";
        return setError(signed.error);
      }

      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });

      if (input.current) input.current.value = "";
      if (uploadError) return setError(`Upload failed: ${uploadError.message}`);

      const saved = await sendProof({ orderId, imageUrl: signed.url, note });
      if (!saved.ok) return setError(saved.error);

      setProofs((p) => [...p, saved.proof]);
      setNote("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-ink-950/10 pt-3">
      {current && (
        <div className="mb-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-ink-950/10"
          />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-ink-950">
              Proof v{current.version} ·{" "}
              {state === "waiting" ? (
                <span className="text-warn-700">waiting on them</span>
              ) : state === "approved" ? (
                <span className="text-ok-700">approved</span>
              ) : (
                <span className="text-bad-700">changes asked for</span>
              )}
            </p>
            <p className="text-ink-900/55">
              sent {formatDateTime(current.sentAt)}
            </p>
          </div>
        </div>
      )}

      {/* The reason the next photograph looks different. Whoever is about to
          take it is the person who needs this on screen. */}
      {asked.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 rounded-xl bg-warn-500/10 px-3 py-2 text-xs text-ink-900/80">
          {asked.map((a) => (
            <li key={a.version}>
              <span className="font-mono text-ink-900/45">v{a.version}</span> {a.reply}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything they should look at? e.g. Check the spelling of both names."
            className="w-full rounded-xl border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm outline-none placeholder:text-ink-900/35 focus:border-brand-600"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`cursor-pointer rounded-full bg-brand-700 px-4 py-2 text-xs font-bold text-paper-50 transition-transform hover:scale-105 ${
                pending ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {pending ? "Sending…" : "Choose the photo"}
              <input
                ref={input}
                type="file"
                accept={Object.keys(IMAGE_TYPES).join(",")}
                capture="environment"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-full px-3 py-2 text-xs font-bold text-ink-900/55 hover:text-ink-950"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-ink-950 px-4 py-2 text-xs font-bold text-paper-50 transition-transform hover:scale-105"
        >
          {state === "none"
            ? "Send a proof"
            : state === "rework"
              ? "Send the new proof"
              : "Send another proof"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-bad-700">{error}</p>}
    </div>
  );
}
