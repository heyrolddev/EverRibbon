"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SpecFields } from "@/components/spec-fields";
import { SpecList } from "@/components/spec-list";
import { questionsFor, type SpecAnswer, type SpecQuestion } from "@/lib/spec";
import { saveLineSpec } from "@/app/admin/orders/spec-actions";

/**
 * What was agreed — and changing it when it changes.
 *
 * "Pinalitan niya ang kulay" is a Tuesday in this trade, not an edge case.
 * Without somewhere to put the correction it lives in a chat thread, and the
 * person at the bench is working from this card, which still says maroon.
 *
 * The answers read as plain text until somebody taps Change, so the common
 * case — reading them — is not a form.
 */
export function SpecTweak({
  lineId,
  categories,
  answers,
  questions,
}: {
  lineId: number;
  categories: string[];
  answers: SpecAnswer[];
  questions: SpecQuestion[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = new Set(answers.map((a) => a.key));
  const askedKeys = new Set(questionsFor(questions, categories).map((q) => q.key));
  const onForm = [
    ...questionsFor(questions, categories),
    ...questions.filter((q) => q.isActive && answered.has(q.key) && !askedKeys.has(q.key)),
  ];

  // Nothing to show and nothing to ask. A shop with no questions gets no
  // control here, rather than a "Change" button that opens an empty form.
  if (answers.length === 0 && onForm.length === 0) return null;

  const begin = () => {
    setError(null);
    setValues(Object.fromEntries(answers.map((a) => [a.key, a.value])));
    setOpen(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveLineSpec({ lineId, categories, values });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <div className="mt-1.5 pl-4">
        <SpecList answers={answers} />
        {onForm.length > 0 && (
          <button
            onClick={begin}
            className="mt-1 text-[11px] font-bold uppercase tracking-widest text-ink-900/40 hover:text-brand-700"
          >
            {answers.length > 0 ? "Change" : "Add the details"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-paper-50 p-3 ring-1 ring-ink-950/10">
      <SpecFields
        questions={onForm}
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-ink-950 px-4 py-2 text-xs font-bold text-paper-50 transition-transform hover:scale-105 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save the change"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-full px-3 py-2 text-xs font-bold text-ink-900/55 hover:text-ink-950"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-bad-700">{error}</span>}
      </div>
    </div>
  );
}
