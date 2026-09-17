"use client";

import { useState } from "react";
import { brand } from "../../config/index.ts";
import { money, quantity, duration, addDays, formatDate } from "@/lib/format";
import { nextSaving, type PriceBreak } from "@/lib/price-breaks";
import {
  quote,
  marginAt,
  QUOTE_VALID_DAYS,
  type QuoteLine,
  type Uplift,
} from "@/lib/quote";
import { verdictFor, type CapacityDay, type Operating } from "@/lib/operating";
import {
  missingRequired,
  questionsFor,
  scopedCategories,
  type SpecQuestion,
} from "@/lib/spec";
import { SpecFields } from "@/components/spec-fields";
import { ReferenceStrip } from "@/components/reference-strip";
import { saveQuote } from "@/app/admin/quotes/actions";

/**
 * Pricing a job while the customer is still on the phone.
 *
 * Everything recomputes as you type, because the question being asked is never
 * "what does this cost" on its own — it is "what happens if I say ₱850", and
 * an answer that needs a save button is an answer that arrives after the
 * conversation ended.
 *
 * Two things are on screen that a pricing form usually hides. The cost
 * build-up, because a price with the cost out of sight is a guess with a
 * decimal point. And the margin AND the markup together, because owners say
 * "fifty percent" meaning either and the difference on ₱100 of cost is ₱50.
 */

/** A source for the numbers, so common work isn't retyped every enquiry. */
export type Preset = {
  id: string;
  name: string;
  /** Minutes to assemble one, from the product row. */
  minutes: number;
  /** ₱ of materials in one, from its recipe. Null when nothing is costed. */
  materials: number | null;
  /** What the shop publishes for it. Zero for anything priced per job. */
  price: number;
  /** Its volume ladder, if it has one. */
  breaks: PriceBreak[];
  /** Its catalogue categories, which decide which questions get asked. */
  categories: string[];
};

/**
 * An order already on the board, being priced.
 *
 * An enquiry and a delivered order are the same row at different moments, so
 * pricing one is an edit rather than a new record — and the desk needs to
 * open holding everything the customer already told the shop, including the
 * answers to its own questions.
 */
export type Existing = {
  id: string;
  ticket: number | null;
  /** Signed links to what they sent as an example of what they want. */
  references: string[];
  contactName: string;
  contactPhone: string;
  notes: string;
  dueDate: string;
  deliveryFee: number;
  upliftKind: Uplift;
  upliftPercent: number;
  lines: {
    label: string;
    qty: number;
    minutesEach: number;
    materialsEach: number;
    priceEach: number | null;
    productId: string | null;
    categories: string[];
    spec: Record<string, string>;
  }[];
};

type Row = QuoteLine & {
  key: number;
  /** The catalogue row a preset came from, so the server can price it itself. */
  productId: string | null;
  /**
   * What kind of work this is, which decides which of the shop's questions
   * are asked about it. Comes from the product for a catalogue line, and from
   * a picker for a bespoke one — a custom graduation bouquet needs the
   * graduation questions just as much as a listed one does.
   */
  categories: string[];
  /** The answers so far, keyed by question. */
  spec: Record<string, string>;
};

const field =
  "w-full rounded-xl border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm " +
  "text-ink-950 outline-none placeholder:text-ink-900/35 focus:border-brand-600";
const label = "text-[11px] font-bold uppercase tracking-widest text-ink-900/50";

let nextKey = 1;
const blank = (): Row => ({
  key: nextKey++,
  label: "",
  qty: 1,
  minutesEach: 0,
  materialsEach: 0,
  priceEach: null,
  listPrice: null,
  breaks: [],
  productId: null,
  categories: [],
  spec: {},
});

/** Empty reads as 0 without the field fighting you as you clear it. */
const numOf = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function QuoteDesk({
  operating,
  days,
  presets,
  questions,
  existing,
  today,
}: {
  operating: Operating;
  days: CapacityDay[];
  presets: Preset[];
  questions: SpecQuestion[];
  /** An enquiry being priced, or null for a job typed from scratch. */
  existing?: Existing | null;
  today: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    existing && existing.lines.length > 0
      ? existing.lines.map((l) => ({
          ...blank(),
          ...l,
          // The catalogue price and its ladder are not carried over: they are
          // whatever the shop publishes today, and the desk looks them up by
          // product. A stale one copied from an enquiry would quote last
          // month's price with this month's confidence.
          listPrice: presets.find((p) => p.id === l.productId)?.price ?? null,
          breaks: presets.find((p) => p.id === l.productId)?.breaks ?? [],
        }))
      : [blank()]
  );
  const [uplift, setUplift] = useState<Uplift>(existing?.upliftKind ?? "margin");
  const [percent, setPercent] = useState(existing?.upliftPercent ?? 60);
  const [due, setDue] = useState(existing?.dueDate ?? "");
  const [deliveryFee, setDeliveryFee] = useState(existing?.deliveryFee ?? 0);
  const [discount, setDiscount] = useState(0);
  const [name, setName] = useState(existing?.contactName ?? "");
  const [phone, setPhone] = useState(existing?.contactPhone ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  // Nothing is marked missing until somebody tries to save. A blank new line
  // outlined in red is an error the person has not made yet.
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; ticket: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dayRow = days.find((d) => d.day === due);
  // Whole days between today and the date asked for. Negative is the past,
  // which the date input already refuses, but the arithmetic shouldn't rely
  // on that: a stale tab can hold yesterday.
  const daysAway = due
    ? Math.round(
        (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
          86_400_000
      )
    : Infinity;

  // Priced once with no rush, to find out how many minutes are wanted; the
  // calendar's answer then feeds the real pricing. The alternative is asking
  // the calendar about a number that depends on its own answer.
  //
  // Not memoised: `quote` is arithmetic over a handful of rows, and the
  // compiler memoises what is worth memoising. A hand-written useMemo here
  // only stopped it doing that.
  const dry = quote({
    lines: rows,
    uplift: { kind: uplift, percent },
    deliveryFee,
    discount,
    rushFeePercent: 0,
    op: operating,
  });

  const verdict = due ? verdictFor(dayRow, dry.minutes, operating, daysAway) : null;
  const rushFeePercent = verdict?.ok ? verdict.rushFeePercent ?? 0 : 0;

  const q = quote({
    lines: rows,
    uplift: { kind: uplift, percent },
    deliveryFee,
    discount,
    rushFeePercent,
    op: operating,
  });

  const set = (key: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // The categories the shop has actually scoped a question to. Anything else
  // in the catalogue is not worth offering as a choice here, because picking
  // it would change nothing on the screen.
  const askedAbout = scopedCategories(questions);

  /** The questions this line is asked, given what kind of work it is. */
  const asksFor = (row: Row) => questionsFor(questions, row.categories);

  const answer = (key: number, field: string, value: string) =>
    setRows((r) =>
      r.map((row) =>
        row.key === key ? { ...row, spec: { ...row.spec, [field]: value } } : row
      )
    );

  // Which required questions are unanswered, per line. Computed for the
  // whole form rather than per keystroke so the save button and the red
  // outlines can never disagree about what is missing.
  const shortfall = new Map<number, string[]>();
  for (const row of rows) {
    if (!row.label.trim() || row.qty <= 0) continue;
    const gaps = missingRequired(asksFor(row), row.spec);
    if (gaps.length > 0) shortfall.set(row.key, gaps.map((g) => g.key));
  }

  const applyPreset = (key: number, id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    set(key, {
      label: p.name,
      minutesEach: p.minutes,
      // The shop's own price comes with it, ladder and all, so ten rolls
      // quote at the ten-roll price without anyone looking it up. Clearing
      // the price field hands the line back to the margin target.
      productId: p.id,
      listPrice: p.price > 0 ? p.price : null,
      breaks: p.breaks,
      categories: p.categories,
      priceEach: null,
      // A product nobody has costed prefills nothing rather than zero: zero is
      // a claim that it is free to make, and it would read as pure margin.
      ...(p.materials === null ? {} : { materialsEach: p.materials }),
    });
  };

  const onSave = async () => {
    setTried(true);
    if (shortfall.size > 0) {
      // A disabled button with a red box somewhere below it is a puzzle. Say
      // what is missing, in the words the shop wrote.
      const names = rows
        .filter((r) => shortfall.has(r.key))
        .map((r) => `"${r.label.trim() || "an untitled line"}"`)
        .join(", ");
      return setError(`${names} still needs an answer to a required question.`);
    }
    setSaving(true);
    setError(null);
    const res = await saveQuote({
      // The enquiry this is a price FOR, when there is one. One record from
      // "someone asked" to "handed over", so nothing has to be copied across
      // at the moment the customer says yes.
      orderId: existing?.id ?? null,
      contactName: name.trim(),
      contactPhone: phone.trim(),
      notes: notes.trim(),
      dueDate: due || null,
      upliftKind: uplift,
      upliftPercent: percent,
      deliveryFee,
      discount,
      rushFeePercent,
      lines: rows
        .filter((r) => r.label.trim() && r.qty > 0)
        .map((r) => ({
          label: r.label.trim(),
          qty: r.qty,
          minutesEach: r.minutesEach,
          materialsEach: r.materialsEach,
          priceEach: r.priceEach,
          // The id, not the price. The server looks the price up.
          productId: r.productId,
          // The typed answers, not the finished spec. The server rebuilds it
          // from its own copy of the questions, for the same reason it
          // reprices: a browser may say what was answered, never what was
          // asked.
          categories: r.categories,
          spec: r.spec,
        })),
    });
    setSaving(false);
    if (res.ok) setSaved({ id: res.id, ticket: res.ticket });
    else setError(res.error);
  };

  // The button stays live even with a required answer missing: pressing it is
  // how somebody finds out which one, and a button that is simply dead
  // explains nothing.
  const usable = rows.some((r) => r.label.trim() && r.qty > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        {/* ------------------------------------------------------- the job -- */}
        <section className="rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          <h3 className="font-display text-lg font-black text-ink-950">What they want</h3>

          {/* Before the fields, because on a job that came in as a photograph
              this is what the fields are describing. */}
          {existing && <ReferenceStrip links={existing.references} className="mt-3" />}

          <div className="mt-4 flex flex-col gap-4">
            {rows.map((row, i) => {
              const priced = q.lines[i];
              return (
                <div key={row.key} className="rounded-xl bg-paper-50 p-4 ring-1 ring-ink-950/10">
                  <div className="flex items-start gap-2">
                    <input
                      value={row.label}
                      onChange={(e) => set(row.key, { label: e.target.value })}
                      placeholder="3-stem bouquet, ivory + gold, name printed on the ribbon"
                      className={field}
                    />
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                        aria-label="Remove this line"
                        className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink-900/50 hover:bg-ink-950/5 hover:text-bad-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {presets.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => applyPreset(row.key, e.target.value)}
                      className={`${field} mt-2 text-ink-900/70`}
                    >
                      <option value="">Start from something you already make…</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.minutes > 0 ? ` · ${duration(p.minutes)} each` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className={label}>How many</span>
                      <input
                        type="number" min={0} step="1" inputMode="numeric"
                        value={row.qty}
                        onChange={(e) => set(row.key, { qty: numOf(e.target.value) })}
                        className={field}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={label}>Minutes each</span>
                      <input
                        type="number" min={0} step="0.1" inputMode="decimal"
                        value={row.minutesEach}
                        onChange={(e) => set(row.key, { minutesEach: numOf(e.target.value) })}
                        className={field}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={label}>Materials each</span>
                      <input
                        type="number" min={0} step="0.01" inputMode="decimal"
                        value={row.materialsEach}
                        onChange={(e) => set(row.key, { materialsEach: numOf(e.target.value) })}
                        className={field}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={label}>Price each</span>
                      <input
                        type="number" min={0} step="0.01" inputMode="decimal"
                        // Blank means "work it out"; typing a number takes over.
                        value={row.priceEach ?? ""}
                        placeholder={priced ? String(Math.round((priced.price / Math.max(row.qty, 1)) * 100) / 100) : ""}
                        onChange={(e) =>
                          set(row.key, {
                            priceEach: e.target.value.trim() === "" ? null : Number(e.target.value),
                          })
                        }
                        className={field}
                      />
                    </label>
                  </div>

                  {priced && row.qty > 0 && row.listPrice
                    ? (() => {
                        const next = nextSaving(row.listPrice, row.breaks ?? [], row.qty);
                        return next ? (
                          <button
                            onClick={() => set(row.key, { qty: next.atQty })}
                            className="mt-2 w-full rounded-lg bg-ok-600/10 px-3 py-2 text-left text-xs text-ok-700 hover:bg-ok-600/20"
                          >
                            {next.atQty} would be {money(next.unitPrice)} each —{" "}
                            {money(next.savesTotal)} off. Tap to change it.
                          </button>
                        ) : null;
                      })()
                    : null}

                  {priced && row.qty > 0 && (
                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-900/60">
                      <span>
                        Costs <strong className="tabular-nums text-ink-950">{money(priced.cost)}</strong>
                      </span>
                      <span>
                        Charges <strong className="tabular-nums text-ink-950">{money(priced.price)}</strong>
                      </span>
                      <span>{duration(priced.minutes)} of work</span>
                      {priced.source === "list" ? (
                        <span className="rounded-full bg-ok-600/15 px-2 py-0.5 text-ok-700">
                          your price list
                          {(row.breaks?.length ?? 0) > 0 ? ", at this quantity" : ""}
                        </span>
                      ) : priced.source === "target" ? (
                        <span className="rounded-full bg-ink-950/5 px-2 py-0.5">
                          priced at your target
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-800">
                          {Math.round(marginAt(priced.price, priced.cost).margin)}% margin, your price
                        </span>
                      )}
                    </p>
                  )}

                  {/*
                    The answers that make this the thing they asked for.
                    Below the price on purpose: the call goes "magkano?" first
                    and "ano'ng ilalagay?" second, and a form that asks in the
                    other order is a form somebody abandons halfway.

                    Absent entirely on a shop that asks nothing — this is the
                    shop's own list of questions, not a fixture of the
                    software.
                  */}
                  {(asksFor(row).length > 0 || (askedAbout.length > 0 && !row.productId)) && (
                    <div className="mt-4 border-t border-ink-950/10 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-900/50">
                          What exactly
                        </span>
                        {/*
                          A bespoke line has no product to take its kind from,
                          so it is asked — otherwise a custom graduation
                          bouquet gets the general questions and none of the
                          graduation ones, which is precisely the order that
                          needs them.
                        */}
                        {askedAbout.length > 0 && !row.productId && (
                          <select
                            value={row.categories[0] ?? ""}
                            onChange={(e) =>
                              set(row.key, {
                                categories: e.target.value ? [e.target.value] : [],
                              })
                            }
                            className="rounded-full border border-ink-950/15 bg-paper-50 px-3 py-1.5 text-xs text-ink-900/70 outline-none focus:border-brand-600"
                          >
                            <option value="">What kind of work?</option>
                            {askedAbout.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <SpecFields
                        questions={asksFor(row)}
                        values={row.spec}
                        missing={tried ? (shortfall.get(row.key) ?? []) : []}
                        onChange={(field, value) => answer(row.key, field, value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setRows((r) => [...r, blank()])}
              className="self-start rounded-full bg-ink-950 px-4 py-2 text-sm font-bold text-paper-50 transition-transform hover:scale-105"
            >
              + Another item
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------ the date -- */}
        <section className="rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          <h3 className="font-display text-lg font-black text-ink-950">When they need it</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Due date</span>
              <input
                type="date"
                value={due}
                min={today}
                max={days.at(-1)?.day}
                onChange={(e) => setDue(e.target.value)}
                className={field}
              />
            </label>
            <div className="flex flex-col justify-end">
              {!due && (
                <p className="text-sm text-ink-900/60">
                  Pick a date and the calendar will say whether the work fits.
                </p>
              )}
              {due && verdict && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm ${
                    !verdict.ok
                      ? "bg-bad-600/10 text-bad-700"
                      : rushFeePercent > 0
                        ? "bg-warn-500/15 text-warn-700"
                        : "bg-ok-600/10 text-ok-700"
                  }`}
                >
                  {!verdict.ok ? (
                    verdict.reason
                  ) : rushFeePercent > 0 ? (
                    <>
                      That&apos;s {daysAway === 0 ? "today" : `${daysAway} day${daysAway === 1 ? "" : "s"} away`} —
                      inside the rush window, so a {rushFeePercent}% surcharge is
                      on this quote. It fits: {duration(dry.minutes)} of{" "}
                      {duration(dayRow?.free ?? 0)} free.
                    </>
                  ) : (
                    <>
                      Fits: {duration(dry.minutes)} of {duration(dayRow?.free ?? 0)} free
                      that day.
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- the customer -- */}
        <section className="rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          <h3 className="font-display text-lg font-black text-ink-950">Who it&apos;s for</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Mobile</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={brand.contact.phone}
                className={field}
              />
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-1">
            <span className={label}>Anything else agreed</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Colours confirmed against the gown. Wants a photo before it ships."
              className={field}
            />
          </label>
        </section>
      </div>

      {/* --------------------------------------------------------- the money -- */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-2xl bg-ink-950 p-5 text-paper-100">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-paper-100/50">
              They pay
            </span>
            <span className="font-display text-3xl font-black tabular-nums">
              {money(q.total)}
            </span>
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 text-sm">
            <Line k="Goods" v={money(q.goods)} />
            {q.rushFee > 0 && <Line k={`Rush (${rushFeePercent}%)`} v={money(q.rushFee)} />}
            {q.deliveryFee > 0 && <Line k="Delivery" v={money(q.deliveryFee)} />}
            {q.discount > 0 && <Line k="Discount" v={`−${money(q.discount)}`} />}
          </dl>

          {operating.depositEnabled && (
            <div className="mt-4 border-t border-white/10 pt-3 text-sm">
              <Line k={`Deposit (${operating.depositPercent}%)`} v={money(q.deposit)} strong />
              <Line k="Balance on collection" v={money(q.balance)} />
            </div>
          )}

          <div className="mt-4 border-t border-white/10 pt-3 text-sm">
            <Line k="Costs you" v={money(q.cost.total)} />
            <Line k="You keep" v={money(q.profit)} strong />
            <p className="mt-1 text-xs text-paper-100/50">
              {Math.round(q.marginPercent)}% margin · {Math.round(q.markupPercent)}% markup
              {q.minutes > 0 && ` · ${duration(q.minutes)} of work`}
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          <span className={label}>Price the unpriced lines at</span>
          <div className="mt-2 flex gap-2">
            <input
              type="number" min={0} max={999} step="1" inputMode="numeric"
              value={percent}
              onChange={(e) => setPercent(numOf(e.target.value))}
              className={`${field} w-24`}
            />
            <select
              value={uplift}
              onChange={(e) => setUplift(e.target.value as Uplift)}
              className={field}
            >
              <option value="margin">margin — of the price</option>
              <option value="markup">markup — on the cost</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-ink-900/55">
            On {money(100)} of cost: {money(100 / (1 - Math.min(percent, 99) / 100))} at
            margin, {money(100 * (1 + percent / 100))} at markup. They are not the
            same number.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={label}>Delivery</span>
              <input
                type="number" min={0} step="0.01" inputMode="decimal"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(numOf(e.target.value))}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Discount</span>
              <input
                type="number" min={0} step="0.01" inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(numOf(e.target.value))}
                className={field}
              />
            </label>
          </div>
        </section>

        {q.warnings.length > 0 && (
          <section className="rounded-2xl bg-warn-500/10 p-4 ring-1 ring-warn-500/30">
            <p className="text-[11px] font-bold uppercase tracking-widest text-warn-700">
              Before you send this
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-ink-900/80">
              {q.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          {saved ? (
            <p className="text-sm text-ok-700">
              {existing ? "Priced" : "Saved"} as quote #{saved.ticket}. It stands
              until {formatDate(addDays(today, QUOTE_VALID_DAYS))}.
            </p>
          ) : (
            <>
              <button
                onClick={onSave}
                disabled={saving || !usable}
                className="w-full rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-paper-50 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? "Saving…"
                  : existing
                    ? `Send this price to #${existing.ticket ?? "them"}`
                    : "Save this quote"}
              </button>
              <p className="mt-2 text-center text-xs text-ink-900/55">
                {existing
                  ? "Their enquiry keeps its place on the board — this puts a price on it. Nothing is booked until they agree."
                  : "Saved as a quote, not an order. Nothing is booked and no stock moves until they agree to it."}
              </p>
              {error && <p className="mt-2 text-sm text-bad-700">{error}</p>}
            </>
          )}
        </section>

        <p className="px-1 text-xs text-ink-900/45">
          Rates come from Capacity and Payments. {quantity(operating.capacityMinutesPerDay)} minutes
          a day, {operating.labourRatePerHour > 0 ? `${money(operating.labourRatePerHour)} an hour` : "no hourly rate set"}.
        </p>
      </aside>
    </div>
  );
}

function Line({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-bold" : "text-paper-100/60"}>{k}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold" : ""}`}>{v}</dd>
    </div>
  );
}
