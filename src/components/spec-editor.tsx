"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SPEC_KINDS, type SpecKind, type SpecQuestion } from "@/lib/spec";
import {
  moveQuestion,
  removeQuestion,
  saveQuestion,
  setQuestionActive,
  type QuestionDraft,
} from "@/app/admin/spec/actions";

/**
 * What the shop asks about a job.
 *
 * The questions are rows, not code, so this screen is the whole feature: a
 * shop that learns in March that it should have been asking which side the
 * name goes on can start asking in March.
 *
 * Deleting is offered plainly rather than hidden behind a warning, because
 * here it really is safe — every answer already given carries the question's
 * wording with it, so an order from last year reads the same after the
 * question is gone. Retiring is the other choice, for a question the shop
 * might want back.
 */

const field =
  "w-full rounded-xl border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm " +
  "text-ink-950 outline-none placeholder:text-ink-900/35 focus:border-brand-600";
const tag = "text-[11px] font-bold uppercase tracking-widest text-ink-900/50";

type Draft = QuestionDraft & { optionsText: string };

const draftOf = (q: SpecQuestion): Draft => ({
  id: q.id,
  label: q.label,
  hint: q.hint ?? "",
  kind: q.kind,
  options: q.options,
  optionsText: q.options.join("\n"),
  required: q.required,
  category: q.category,
});

const blank = (): Draft => ({
  label: "",
  hint: "",
  kind: "text",
  options: [],
  optionsText: "",
  required: false,
  category: null,
});

/**
 * One question, being written.
 *
 * Defined outside `SpecEditor` on purpose. A component declared inside
 * another is a new component type on every render, so React unmounts and
 * remounts it — which in a form means the input loses focus after every
 * single keystroke.
 */
function Form({
  draft,
  onChange,
  onSave,
  onCancel,
  pending,
  categories,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  categories: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={tag}>The question</span>
        <input
          autoFocus
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="Name to print on the ribbon"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={tag}>The example that stops the wrong answer</span>
        <input
          value={draft.hint}
          onChange={(e) => onChange({ ...draft, hint: e.target.value })}
          placeholder="Exactly as it should print, middle initial and all"
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={tag}>Kind of answer</span>
          <select
            value={draft.kind}
            onChange={(e) => onChange({ ...draft, kind: e.target.value as SpecKind })}
            className={field}
          >
            {SPEC_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label} — {k.hint}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={tag}>Asked about</span>
          <select
            value={draft.category ?? ""}
            onChange={(e) => onChange({ ...draft, category: e.target.value || null })}
            className={field}
          >
            <option value="">Every job</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                Only {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.kind === "choice" && (
        <label className="flex flex-col gap-1">
          <span className={tag}>The choices — one per line</span>
          <textarea
            rows={4}
            value={draft.optionsText}
            onChange={(e) => onChange({ ...draft, optionsText: e.target.value })}
            placeholder={"Maroon\nGold\nIvory"}
            className={`${field} font-mono`}
          />
          {/* The reason a fixed list is worth the typing. */}
          <span className="text-[11px] text-ink-900/45">
            A list is how you stop receiving maroon, Maroon, dark red and
            burgundy as four different colours.
          </span>
        </label>
      )}

      <label className="flex items-start gap-2 text-sm text-ink-900/75">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => onChange({ ...draft, required: e.target.checked })}
          className="mt-1 h-4 w-4 accent-brand-700"
        />
        <span>
          <strong className="text-ink-950">Must be answered.</strong> A quote
          can&apos;t be saved without it — so only for things the job genuinely
          cannot start without, not things you&apos;d like to know.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSave}
          disabled={pending || !draft.label.trim()}
          className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-paper-50 transition-transform hover:scale-105 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className="rounded-full px-4 py-2 text-sm font-bold text-ink-900/60 hover:text-ink-950"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SpecEditor({
  questions,
  categories,
}: {
  questions: SpecQuestion[];
  /** Every category in the catalogue, so a question can be aimed at one. */
  categories: string[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });

  const save = (d: Draft, done: () => void) =>
    run(
      async () =>
        saveQuestion({
          id: d.id,
          label: d.label,
          hint: d.hint,
          kind: d.kind,
          options: d.optionsText.split("\n"),
          required: d.required,
          category: d.category,
        }),
      done
    );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-2xl bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-800">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const open = editing?.id === q.id;
          const kind = SPEC_KINDS.find((k) => k.kind === q.kind);
          return (
            <li
              key={q.id}
              className={`rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10 ${
                q.isActive ? "" : "opacity-60"
              }`}
            >
              {open && editing ? (
                <Form
                  draft={editing}
                  onChange={setEditing}
                  onSave={() => save(editing, () => setEditing(null))}
                  onCancel={() => setEditing(null)}
                  pending={pending}
                  categories={categories}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-black text-ink-950">
                        {q.label}
                        {q.required && (
                          <span className="ml-2 align-middle text-xs font-bold uppercase tracking-widest text-brand-700">
                            must answer
                          </span>
                        )}
                      </p>
                      {q.hint && (
                        <p className="mt-0.5 text-sm text-ink-900/60">{q.hint}</p>
                      )}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-900/55">
                        <span>{kind?.label ?? q.kind}</span>
                        <span>{q.category ? `Only ${q.category}` : "Every job"}</span>
                        {q.options.length > 0 && <span>{q.options.join(" · ")}</span>}
                        {!q.isActive && (
                          <span className="font-bold text-ink-900/70">
                            Not being asked
                          </span>
                        )}
                        {/* The key answers "why does an old order say that",
                            which is the one question this screen gets that it
                            cannot otherwise answer. */}
                        <span className="font-mono text-ink-900/35">{q.key}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => run(() => moveQuestion(q.id, "up"))}
                        disabled={pending || i === 0}
                        aria-label={`Move "${q.label}" up`}
                        className="rounded-lg px-2 py-1 text-ink-900/45 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => run(() => moveQuestion(q.id, "down"))}
                        disabled={pending || i === questions.length - 1}
                        aria-label={`Move "${q.label}" down`}
                        className="rounded-lg px-2 py-1 text-ink-900/45 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-25"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setEditing(draftOf(q))}
                        className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-950 ring-1 ring-ink-950/15 hover:bg-ink-950/5"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-950/10 pt-3">
                    <button
                      onClick={() => run(() => setQuestionActive(q.id, !q.isActive))}
                      disabled={pending}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-900/60 hover:bg-ink-950/5 hover:text-ink-950"
                    >
                      {q.isActive ? "Stop asking this" : "Ask this again"}
                    </button>
                    <button
                      onClick={() => run(() => removeQuestion(q.id))}
                      disabled={pending}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-bad-700 hover:bg-bad-600/10"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="rounded-2xl bg-paper-100 p-5 ring-1 ring-brand-700/30">
          <Form
            draft={adding}
            onChange={setAdding}
            onSave={() => save(adding, () => setAdding(null))}
            onCancel={() => setAdding(null)}
            pending={pending}
            categories={categories}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(blank())}
          className="self-start rounded-full bg-ink-950 px-5 py-2.5 text-sm font-bold text-paper-50 transition-transform hover:scale-105"
        >
          + Add a question
        </button>
      )}
    </div>
  );
}
