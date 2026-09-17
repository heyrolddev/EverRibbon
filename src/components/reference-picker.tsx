"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_TYPES } from "@/lib/media";
import { fitShrink } from "@/lib/shrink-image";
import {
  MAX_REFERENCES,
  REFERENCE_EDGE,
  REFERENCE_QUALITY,
} from "@/lib/references";

/**
 * "Ganito po ang gusto ko."
 *
 * The most common first message a made-to-order shop gets is a photograph,
 * and a form that takes the colours, the date and the name to print but not
 * the picture is a form people abandon for Messenger.
 *
 * The photo is shrunk here, in the browser, before a byte leaves the phone —
 * a 4MB camera picture goes as a couple of hundred kilobytes. That is not a
 * size limit wearing a friendly face: somebody on a prepaid connection
 * asking for a price has not agreed to spend four megabytes on it, and a
 * limit alone would only hand them the job of finding an image resizer.
 *
 * Kept to its shape rather than squared, because half the point of the
 * photograph is usually what a square would cut off — the length of a sash,
 * the shape of a bouquet.
 */

export type Reference = { file: File; preview: string };

export function ReferencePicker({
  photos,
  onChange,
}: {
  photos: Reference[];
  onChange: (next: Reference[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Each preview is an object URL, and one that is never revoked is the
   * photograph still held in memory after the form showing it has gone.
   *
   * Through a ref, not through the dependency list. An unmount cleanup with
   * an empty list closes over the FIRST render's photos — which is the empty
   * array, so it revoked nothing at all and the leak it was written to
   * prevent was still there. Naming every photo in the list instead would
   * revoke the URL of a photo still on screen on every single change.
   */
  const live = useRef<Reference[]>([]);
  // Kept current in an effect rather than during render: a ref written while
  // rendering is a ref React may throw away, and the lint rule that says so
  // is right.
  useEffect(() => {
    live.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      for (const p of live.current) URL.revokeObjectURL(p.preview);
    },
    []
  );

  const room = MAX_REFERENCES - photos.length;

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);

    const chosen = [...files].slice(0, room);
    const added: Reference[] = [];
    try {
      for (const file of chosen) {
        if (!IMAGE_TYPES[file.type]) {
          setError("Photos only — JPG, PNG, WEBP or GIF.");
          continue;
        }
        const { blob, type } = await fitShrink(file, REFERENCE_EDGE, REFERENCE_QUALITY);
        const ext = type === "image/webp" ? "webp" : "jpg";
        added.push({
          file: new File([blob], `reference-${added.length + 1}.${ext}`, { type }),
          preview: URL.createObjectURL(blob),
        });
      }
      if (added.length > 0) onChange([...photos, ...added]);
      if (files.length > room) {
        setError(`We'll take ${MAX_REFERENCES} — that's plenty to work from.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo couldn't be prepared.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const remove = (at: number) => {
    const going = photos[at];
    if (going) URL.revokeObjectURL(going.preview);
    onChange(photos.filter((_, i) => i !== at));
  };

  return (
    <div className="mt-4">
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-900/50">
        Got a photo of what you mean?
      </span>

      <div className="mt-2 flex flex-wrap items-start gap-3">
        {photos.map((p, i) => (
          <div
            key={p.preview}
            className="relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-ink-950/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove this photo"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-950/75 text-xs font-bold text-paper-50 hover:bg-ink-950"
            >
              ✕
            </button>
          </div>
        ))}

        {room > 0 && (
          <label
            className={`grid h-24 w-24 cursor-pointer place-items-center rounded-xl border border-dashed border-ink-950/25 text-center text-[11px] font-bold text-ink-900/55 transition-colors hover:border-brand-600 hover:text-brand-700 ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {busy ? "Adding…" : photos.length === 0 ? "+ Add a photo" : "+ Another"}
            <input
              ref={input}
              type="file"
              multiple
              accept={Object.keys(IMAGE_TYPES).join(",")}
              className="hidden"
              onChange={(e) => void pick(e.target.files)}
            />
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-900/50">
        A picture of something similar helps more than a paragraph. Up to{" "}
        {MAX_REFERENCES}, and they&apos;re only seen by the shop.
      </p>
      {error && <p className="mt-1 text-xs text-bad-700">{error}</p>}
    </div>
  );
}
