"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteMeal, saveMeal, uploadMealImage } from "@/app/admin/menu/actions";
import { TrashIcon } from "@/components/icons";
import { CategoryPicker } from "@/components/category-picker";
import type { MenuCategory } from "@/lib/categories";

export type AdminMeal = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  categories: string[];
  image_url: string | null;
  is_public: boolean;
  is_available: boolean;
};

const fieldClass =
  "w-full rounded-xl border-2 border-ink-950/15 bg-paper-50 px-4 py-2 text-sm text-ink-950 outline-none transition-colors focus:border-brand-700";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        checked ? "bg-ok-600 text-paper-50" : "bg-ink-950/10 text-ink-900"
      }`}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

export function MealEditor({
  product,
  categories,
}: {
  product: AdminMeal;
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [description, setDescription] = useState(product.description ?? "");
  const [chosen, setChosen] = useState<string[]>(product.categories ?? []);
  const [isPublic, setIsPublic] = useState(product.is_public);
  const [isAvailable, setIsAvailable] = useState(product.is_available);
  const [imageUrl, setImageUrl] = useState(product.image_url);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * What the database holds, as far as this form knows.
   *
   * The button used to say "Save", then "Saved ✓" for two seconds, then
   * "Save" again — which reads as *you still have work to do* on a form
   * that is already identical to what is stored. Pressing it again writes
   * the same row a second time, and every so often someone sits there
   * pressing it because the label keeps asking them to.
   *
   * So the button reports the form's state rather than the last thing that
   * happened to it. Nothing to save and it says so, greyed out; change one
   * character and it turns back into a live Save. The photo is not in here:
   * it uploads and saves on its own the moment it is chosen, so counting it
   * would leave the button asking to save something already saved.
   */
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      name: product.name,
      price: String(product.price),
      description: product.description ?? "",
      chosen: product.categories ?? [],
      isPublic: product.is_public,
      isAvailable: product.is_available,
    })
  );

  const snapshot = JSON.stringify({
    name,
    price,
    description,
    chosen,
    isPublic,
    isAvailable,
  });
  // Compared as JSON rather than field by field so that adding a field to the
  // form cannot quietly leave it out of the comparison. Category order is
  // part of the value on purpose — the first one is the product's main category
  // and decides its colour, so reordering is a real change.
  const dirty = snapshot !== savedSnapshot;
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteMeal(product.id);
      if (res.error) {
        setConfirmDelete(false);
        return setError(res.error);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await saveMeal({
        id: product.id,
        name,
        price: Number(price),
        description,
        categories: chosen,
        isPublic,
        isAvailable,
      });
      if (res.error) return setError(res.error);
      // The form is now what the database holds, so the button goes quiet
      // until something actually changes again.
      setSavedSnapshot(snapshot);
      router.refresh();
    } catch (e) {
      // Without this a thrown Server Action would leave the button stuck.
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("productId", product.id);
    fd.set("file", file);
    try {
      const res = await uploadMealImage(fd);
      if (res.error) return setError(res.error);
      if (res.url) setImageUrl(res.url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-4 rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10 sm:flex-row"
    >
      {/* Whatever shape the customer's menu card is, this matches it. When the
          two disagree the owner approves a crop nobody else ever sees, and the
          live menu quietly loses the edges of every photo. */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="relative aspect-square w-32 overflow-hidden rounded-xl bg-gradient-to-br from-warn-400 to-brand-700">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-3xl font-black text-paper-50/80">
              {(product.name.match(/[a-zA-Z0-9]/)?.[0] ?? "?").toUpperCase()}
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-full bg-ink-950 px-3 py-1.5 text-xs font-bold text-paper-50 transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {imageUrl ? "Replace photo" : "Add photo"}
        </button>
        {/* The one number that stops photos being trimmed. Said here, where
            the photo is chosen, rather than in a document nobody opens. */}
        <p className="text-center text-[11px] leading-tight text-ink-900/45">
          Best at <strong className="font-semibold">1200 × 1200</strong>
          <br />
          (square)
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className={fieldClass}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Price"
            className={fieldClass}
          />
          <CategoryPicker
            value={chosen}
            onChange={setChosen}
            categories={categories}
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short description shown on the menu (optional)"
          className={fieldClass}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Toggle checked={isPublic} onChange={setIsPublic} label="Shown on menu" />
          <Toggle checked={isAvailable} onChange={setIsAvailable} label="Available" />

          {confirmDelete ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-900">Delete this item?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="rounded-full bg-brand-700 px-4 py-2 text-xs font-bold text-paper-50 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full px-3 py-2 text-xs font-bold text-ink-900 hover:text-brand-700"
              >
                Keep
              </button>
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label={`Delete ${product.name}`}
                title="Delete this item"
                className="ml-auto grid h-9 w-9 place-items-center rounded-full text-ink-900/50 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
              >
                <TrashIcon className="h-4 w-4" />
              </button>

              <button
                type="submit"
                disabled={busy || !dirty}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                  dirty
                    ? "bg-brand-700 text-paper-50 hover:bg-brand-800 disabled:opacity-60"
                    : "cursor-default bg-ok-600/15 text-ok-700"
                }`}
              >
                {busy ? "Saving…" : dirty ? "Save changes" : "Saved ✓"}
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
