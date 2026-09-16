"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, checkMedia, IMAGE_TYPES } from "@/lib/media";
import { saveWordmark, signWordmarkUpload } from "@/app/admin/brand/actions";
import type { Wordmark } from "@/lib/brand-assets";

/**
 * One wordmark, uploaded and kept with the size the browser measured.
 *
 * The measurement is the point. A logo stored without its own pixel size
 * cannot have its space reserved, so the header jumps as it loads — on every
 * first visit, on every page. The browser has the number the moment it has
 * decoded the file; nowhere else does, short of fetching back the file we
 * just uploaded.
 */
export function WordmarkField({
  ground,
  title,
  blurb,
  initial,
  /** Drawn behind the preview, so a pale mark is judged on the ground it lives on. */
  preview,
}: {
  ground: "light" | "dark";
  title: string;
  blurb: string;
  initial: Wordmark | null;
  preview: "light" | "dark";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [mark, setMark] = useState<Wordmark | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** The file's own width and height, from a decode the browser has to do anyway. */
  const measure = (file: File) =>
    new Promise<{ width: number; height: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!IMAGE_TYPES[file.type]) {
      if (input.current) input.current.value = "";
      return setError("A logo has to be a PNG, JPG, WEBP or GIF.");
    }
    // Checked here as well as on the server, so nobody watches an upload run
    // for a minute only to be told it was never going to be accepted.
    const checked = checkMedia(file.type, file.size);
    if (!checked.ok) {
      if (input.current) input.current.value = "";
      return setError(checked.error);
    }

    start(async () => {
      const size = await measure(file);
      if (!size) {
        if (input.current) input.current.value = "";
        return setError("That file could not be read as an image.");
      }

      const signed = await signWordmarkUpload({ type: file.type, size: file.size });
      if (!signed.ok) {
        if (input.current) input.current.value = "";
        return setError(signed.error);
      }

      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type,
        });

      if (input.current) input.current.value = "";
      if (uploadError) return setError(`Upload failed: ${uploadError.message}`);

      const saved = await saveWordmark({ ground, url: signed.url, ...size });
      if (!saved.ok) return setError(saved.error);
      setMark({ src: signed.url, ...size });
    });
  }

  function clear() {
    setError(null);
    start(async () => {
      const saved = await saveWordmark({ ground, url: null, width: null, height: null });
      if (!saved.ok) return setError(saved.error);
      setMark(null);
    });
  }

  const dark = preview === "dark";

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
      <div>
        <h3 className="font-display text-lg font-black text-ink-950">{title}</h3>
        <p className="mt-1 max-w-[56ch] text-sm text-ink-900/65">{blurb}</p>
      </div>

      <div
        className={`grid min-h-32 place-items-center rounded-xl p-6 ${
          dark ? "bg-ink-950" : "bg-paper-50 ring-1 ring-ink-950/10"
        }`}
      >
        {mark ? (
          // A plain <img>: this is a preview of a file that was uploaded a
          // second ago, and routing it through the optimiser only adds a
          // cache that has to be busted before the owner can see their change.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mark.src}
            alt=""
            className="max-h-24 w-auto max-w-full object-contain"
          />
        ) : (
          <p className={`text-sm ${dark ? "text-paper-100/50" : "text-ink-900/45"}`}>
            Nothing uploaded — the shop&apos;s name is set in its own face instead.
          </p>
        )}
      </div>

      {mark && (
        <p className="font-mono text-xs text-ink-900/50">
          {mark.width} × {mark.height}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-bold text-paper-50 transition-transform hover:scale-105 ${
            pending ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {pending ? "Working…" : mark ? "Replace" : "Upload"}
          <input
            ref={input}
            type="file"
            accept={Object.keys(IMAGE_TYPES).join(",")}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {mark && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-900/60 hover:text-bad-700 disabled:opacity-40"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-sm text-bad-700">{error}</p>}
    </section>
  );
}
