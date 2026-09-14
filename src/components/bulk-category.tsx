"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCategoryToMeals } from "@/app/admin/menu/actions";
import { CategoryPicker } from "@/components/category-picker";
import type { AdminMeal } from "@/components/product-editor";
import type { MenuCategory } from "@/lib/categories";

/**
 * Tagging the products that have no category, several at a time.
 *
 * Appears only when there are untagged products, and disappears the moment
 * there are none. A panel that is always there teaching you about a problem
 * you do not have is a panel people learn to scroll past — and this one is
 * about a real problem with a countable end.
 *
 * It says the consequence rather than the state. "42 products have no category"
 * is a fact about the database; "customers can't filter to them" is the reason
 * anybody should care, and it is the sentence that gets the work done.
 */
export function BulkCategory({
  products,
  categories,
}: {
  products: AdminMeal[];
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const untagged = useMemo(
    () => products.filter((m) => (m.categories ?? []).length === 0),
    [products]
  );

  const [picked, setPicked] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (untagged.length === 0) return null;

  const category = picked[0] ?? "";
  const ready = category !== "" && chosen.size > 0 && !busy;

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await addCategoryToMeals({ ids: [...chosen], category });
      if (res.error) return setError(res.error);
      setDone(
        `${res.changed} product${res.changed === 1 ? "" : "es"} tagged “${category}”.`
      );
      setChosen(new Set());
      setPicked([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not tag those products.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-accent-300/20 p-6 ring-1 ring-accent-200/40 sm:p-7">
      <h3 className="font-display text-lg font-black tracking-tight text-ink-950">
        {untagged.length} product{untagged.length === 1 ? "" : "es"} have no
        category
      </h3>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-900/75">
        Customers filter the menu by category. A product with none is only
        findable by scrolling or by typing its exact name — so these are the
        products people give up looking for. Tick a few, choose a category, and
        tag them together.
      </p>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-900/50">
          Which products
        </p>
        <div className="flex flex-wrap gap-1.5">
          {untagged.map((m) => {
            const on = chosen.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  on
                    ? "bg-ink-950 text-paper-50"
                    : "bg-paper-50 text-ink-900/75 ring-1 ring-ink-950/10 hover:bg-paper-100"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setChosen(new Set(untagged.map((m) => m.id)))}
            className="text-ink-900/70 underline underline-offset-4 hover:text-brand-700"
          >
            Select all {untagged.length}
          </button>
          {chosen.size > 0 && (
            <button
              type="button"
              onClick={() => setChosen(new Set())}
              className="text-ink-900/70 underline underline-offset-4 hover:text-brand-700"
            >
              Clear
            </button>
          )}
          <span className="text-ink-900/50">{chosen.size} picked</span>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-900/50">
          Which category
        </p>
        {/* The same picker as the product form, so a name typed here joins the
            shop's vocabulary exactly as it would there. Capped at one: this
            adds a category, and adding several at once to a pile of products is
            a harder thing to check afterwards than to do again. */}
        <CategoryPicker
          categories={categories}
          value={picked}
          onChange={(next) => setPicked(next.slice(-1))}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-paper-50">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-4 rounded-xl bg-ok-600/15 px-4 py-2.5 text-sm font-semibold text-ok-700">
          {done}
        </p>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={!ready}
        className="mt-5 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-paper-50 transition-colors hover:bg-brand-800 disabled:opacity-50"
      >
        {busy
          ? "Tagging…"
          : chosen.size > 0 && category
            ? `Tag ${chosen.size} product${chosen.size === 1 ? "" : "es"} as “${category}”`
            : "Tag the picked products"}
      </button>
    </section>
  );
}
