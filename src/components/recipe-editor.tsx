"use client";
import { money } from "@/lib/format";
import { brand } from "../../config/index.ts";

import { useMemo, useState, useTransition } from "react";
import { AdminDialog, Field, inputClass } from "@/components/admin-dialog";
import { Combobox } from "@/components/combobox";
import {
  produceRun,
  saveBatchRecipe,
  saveMealRecipe,
  saveMealPackaging,
  saveOrderPackaging,
} from "@/app/admin/inventory/actions";

/** Something a recipe line can point at. */
export type RecipeOption = {
  id: string;
  name: string;
  unit: string;
  /** ₱ per unit — for a material its cost, for a production_run its cost per yield unit. */
  unitCost: number;
  kind: "inv" | "production_run";
  /** How much is on hand, for the shortfall warning when producing. */
  stock: number;
};

export type RecipeLine = { refType: "inv" | "production_run"; refId: string; qty: number };

/**
 * What goes into a thing.
 *
 * One editor for both products and production_runs, because they are the same shape —
 * a list of "this much of that" — and two of these would drift the day one
 * of them gained a feature. A product may draw on production_runs as well as
 * materials; a production_run may only use materials, since a production_run made of
 * production_runs is a recursion nobody at the stall asked for.
 *
 * The running cost is the point of the screen. Editing a recipe without
 * seeing what it does to the cost is editing blind, and the number that
 * matters — what this product now costs to make — is one subtraction away from
 * the price.
 */
export function RecipeEditor({
  title,
  subtitle,
  /** Null when editing a production_run: a production_run has no selling price. */
  price,
  options,
  initial,
  target,
  onClose,
}: {
  title: string;
  subtitle?: string;
  price: number | null;
  options: RecipeOption[];
  initial: RecipeLine[];
  target:
    | { kind: "product"; productId: string }
    | { kind: "production_run"; productionRunId: string }
    | { kind: "packaging"; productId: string }
    | { kind: "order-packaging" };
  onClose: () => void;
}) {
  const [lines, setLines] = useState<RecipeLine[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(options.map((o) => [`${o.kind}:${o.id}`, o])),
    [options]
  );
  const allowed = useMemo(
    () =>
      target.kind === "production_run" ? options.filter((o) => o.kind === "inv") : options,
    [options, target.kind]
  );

  const priced = lines.map((l) => {
    const o = byId.get(`${l.refType}:${l.refId}`);
    return { line: l, option: o, cost: (o?.unitCost ?? 0) * l.qty };
  });
  const total = priced.reduce((s, p) => s + p.cost, 0);

  const setLine = (i: number, patch: Partial<RecipeLine>) =>
    setLines((cur) => cur.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r =
        target.kind === "product"
          ? await saveMealRecipe({ productId: target.productId, lines })
          : target.kind === "packaging"
            ? await saveMealPackaging({ productId: target.productId, lines })
            : target.kind === "order-packaging"
              ? await saveOrderPackaging({ lines })
              : await saveBatchRecipe({
                  productionRunId: target.productionRunId,
                  lines: lines.map((l) => ({ materialId: l.refId, qty: l.qty })),
                });
      if (r.error !== null) {
        setError(r.error);
        return;
      }
      onClose();
    });
  }

  return (
    <AdminDialog title={title} subtitle={subtitle} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const o = byId.get(`${l.refType}:${l.refId}`);
            // The name gets its own row and the full width of the dialog.
            // Squeezed beside the quantity it truncated to "M.Chicken 100 (b"
            // and "T.O/ Noodles (ba", which on a menu full of near-identical
            // production_run names is how the wrong thing gets picked — and on a phone
            // the single row didn't fit at all.
            return (
              <li
                key={i}
                className="rounded-2xl bg-ink-950/[0.03] p-2.5 ring-1 ring-ink-950/5"
              >
                <Combobox
                  value={o ? `${o.kind}:${o.id}` : ""}
                  ariaLabel="What goes in"
                  placeholder="Type to search…"
                  options={allowed.map((opt) => ({
                    value: `${opt.kind}:${opt.id}`,
                    label: opt.kind === "production_run" ? `${opt.name} (production_run)` : opt.name,
                    hint: opt.unit,
                  }))}
                  onChange={(v) => {
                    // Split on the first colon only. An id is free-form text
                    // and a regex with a dot-all flag isn't available at this
                    // TS target anyway.
                    const at = v.indexOf(":");
                    if (at < 0) return;
                    setLine(i, {
                      refType: v.slice(0, at) as "inv" | "production_run",
                      refId: v.slice(at + 1),
                    });
                  }}
                />

                <div className="mt-2 flex items-center gap-2">
                  {/* Wrapped rather than given a `w-24` alongside `inputClass`.
                      That class already carries `w-full`, and which of two
                      competing width utilities wins is decided by the order
                      Tailwind emits them in, not by the order they're written
                      here — `w-full` won, the quantity box ate the row, and
                      the unit and the remove button were pushed off the edge
                      of the dialog. A fixed-width parent has no such
                      argument to lose. */}
                  <div className="w-24 shrink-0">
                    <input
                      value={l.qty || ""}
                      onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })}
                      type="number"
                      step="0.0001"
                      min="0"
                      inputMode="decimal"
                      placeholder="0"
                      aria-label="How much"
                      className={`${inputClass} py-1.5 text-right`}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-ink-900/50">
                    {o?.unit ?? ""}
                  </span>
                  <span className="flex-1 text-right font-display text-sm font-black tabular-nums text-ink-950">
                    {o ? money((o.unitCost || 0) * l.qty) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLines((cur) => cur.filter((_, n) => n !== i))}
                    aria-label="Remove this line"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-950/5 text-ink-900/60 transition-colors hover:bg-brand-700 hover:text-paper-50"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setLines((cur) => [...cur, { refType: "inv", refId: "", qty: 0 }])}
          className="rounded-xl border-2 border-dashed border-ink-950/15 py-2.5 text-sm font-bold text-ink-900/60 transition-colors hover:border-accent-200 hover:text-ink-950"
        >
          + Add a line
        </button>

        <div className="rounded-2xl bg-ink-950 px-5 py-4 text-paper-50">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold opacity-70">
              {target.kind === "product"
                ? "Costs to make"
                : target.kind === "production_run"
                  ? "Costs per production_run"
                  : target.kind === "packaging"
                    ? "Adds to a take-out"
                    : "Adds to every take-out order"}
            </span>
            <span className="font-display text-2xl font-black tabular-nums">
              {money(total)}
            </span>
          </div>
          {price !== null && price > 0 && (
            <div className="mt-2 flex items-baseline justify-between border-t border-paper-50/15 pt-2 text-sm">
              <span className="opacity-70">
                Sells for {money(price, 0)} — you keep
              </span>
              <span
                className={`font-display text-lg font-black tabular-nums ${
                  price - total < 0 ? "text-brand-300" : "text-ok-400"
                }`}
              >
                {money(price - total)}
                <span className="ml-2 text-xs font-bold opacity-60">
                  {((total / price) * 100).toFixed(0)}% food cost
                </span>
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-paper-50">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-ink-950 py-3.5 font-display text-lg font-black text-paper-50 transition-colors hover:bg-ink-900 disabled:bg-ink-950/15 disabled:text-ink-900/40"
        >
          {busy
            ? "Saving…"
            : target.kind === "packaging" || target.kind === "order-packaging"
              ? "Save the packaging"
              : "Save the recipe"}
        </button>
      </form>
    </AdminDialog>
  );
}

/**
 * Cook a production_run.
 *
 * Shows the shopping list against what is actually on the shelf before
 * anything moves. It warns rather than refuses: the pepper may well have
 * been bought this morning and not entered yet, and a system that blocks
 * work which has already happened is a system that gets worked around.
 */
export function ProduceBatchForm({
  production_run,
  recipe,
  options,
  onClose,
}: {
  production_run: { id: string; name: string; yieldQty: number; yieldUnit: string; stock: number };
  recipe: { materialId: string; qty: number }[];
  options: RecipeOption[];
  onClose: () => void;
}) {
  const [multiplier, setMultiplier] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const times = Number(multiplier) || 0;
  const byId = useMemo(
    () => new Map(options.filter((o) => o.kind === "inv").map((o) => [o.id, o])),
    [options]
  );

  const needs = recipe.map((r) => {
    const o = byId.get(r.materialId);
    const needed = r.qty * times;
    return {
      name: o?.name ?? "Deleted material",
      unit: o?.unit ?? "",
      needed,
      have: o?.stock ?? 0,
      short: (o?.stock ?? 0) < needed,
      cost: (o?.unitCost ?? 0) * needed,
    };
  });
  const shortages = needs.filter((n) => n.short);
  const cost = needs.reduce((s, n) => s + n.cost, 0);
  const makes = production_run.yieldQty * times;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await produceRun({ productionRunId: production_run.id, multiplier: times });
      if (r.error !== null) {
        setError(r.error);
        return;
      }
      onClose();
    });
  }

  return (
    <AdminDialog
      title={`Make ${production_run.name}`}
      subtitle={`${production_run.stock.toLocaleString(brand.locale)} ${production_run.yieldUnit} already made.`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="How many production_runs" hint={`One production_run makes ${production_run.yieldQty.toLocaleString(brand.locale)} ${production_run.yieldUnit}.`}>
          <input
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            type="number"
            step="0.25"
            min="0"
            inputMode="decimal"
            autoFocus
            className={inputClass}
          />
        </Field>

        {recipe.length === 0 ? (
          <p className="rounded-xl bg-warn-500/15 px-4 py-3 text-sm text-ink-950">
            This production_run has no recipe yet, so there&apos;s nothing to make it
            from. Add one first.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl ring-1 ring-ink-950/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-950/5">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-ink-900/50">
                  <th className="px-3 py-2">Needs</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">On hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-950/5">
                {needs.map((n, i) => (
                  <tr key={i} className={n.short ? "bg-brand-700/10" : ""}>
                    <td className="px-3 py-1.5 font-semibold text-ink-950">{n.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-ink-900/70">
                      {n.needed.toLocaleString(brand.locale, { maximumFractionDigits: 2 })} {n.unit}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        n.short ? "font-black text-brand-700" : "text-ink-900/50"
                      }`}
                    >
                      {n.have.toLocaleString(brand.locale, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {shortages.length > 0 && (
          <p className="rounded-xl bg-accent-200 px-4 py-3 text-sm text-ink-950">
            <strong>Not enough {shortages.map((s) => s.name).join(", ")}.</strong>{" "}
            You can still record it — if you bought more and haven&apos;t
            entered it yet, do that first, or the count will go negative.
          </p>
        )}

        <div className="flex items-baseline justify-between rounded-2xl bg-ink-950 px-5 py-4 text-paper-50">
          <span className="text-sm font-bold opacity-70">
            Makes {makes.toLocaleString(brand.locale)} {production_run.yieldUnit}
          </span>
          <span className="font-display text-2xl font-black tabular-nums">
            {money(cost)}
          </span>
        </div>

        {error && (
          <p className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-paper-50">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || times <= 0 || recipe.length === 0}
          className="w-full rounded-2xl bg-ok-600 py-3.5 font-display text-lg font-black text-paper-50 transition-colors hover:bg-ok-700 disabled:bg-ink-950/15 disabled:text-ink-900/40"
        >
          {busy ? "Recording…" : "We made it"}
        </button>
      </form>
    </AdminDialog>
  );
}
