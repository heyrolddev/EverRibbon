"use client";

import { YES, NO, type SpecQuestion } from "@/lib/spec";

/**
 * The shop's own questions, as a form.
 *
 * One component, used wherever a job is being described — the quote desk now,
 * an enquiry form later — because the questions come from a table and the
 * only thing a second copy of this could do is disagree with the first.
 *
 * Nothing here is hard-coded about ribbon, or bouquets, or names printed on
 * things. It renders whatever the shop decided to ask.
 */

// The border colour is appended by the caller below, never included here.
// Two border-colour classes on one element is decided by which one Tailwind
// happens to emit last, not by which one is written last — which is how a
// "this is missing" outline ends up invisible.
const field =
  "w-full rounded-xl border bg-paper-50 px-3 py-2 text-sm " +
  "text-ink-950 outline-none placeholder:text-ink-900/35 focus:border-brand-600";

export function SpecFields({
  questions,
  values,
  onChange,
  /** Which required ones are being complained about, by key. */
  missing = [],
}: {
  questions: SpecQuestion[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  missing?: string[];
}) {
  // A shop that asks nothing gets nothing — not an empty panel with a
  // heading over it, which is the usual way a configurable section announces
  // that it has not been configured.
  if (questions.length === 0) return null;

  const wanted = new Set(missing);

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {questions.map((q) => {
        const value = values[q.key] ?? "";
        const bad = wanted.has(q.key);
        const cls = `${field} ${bad ? "border-bad-600" : "border-ink-950/15"}`;
        // A long answer and a list of choices both want the full width; a
        // name and a number sit happily two to a row.
        const wide = q.kind === "long_text";

        return (
          <label
            key={q.key}
            className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-900/50">
              {q.label}
              {q.required && <span className="ml-1 text-brand-700">*</span>}
            </span>

            {q.kind === "long_text" ? (
              <textarea
                rows={2}
                value={value}
                placeholder={q.hint ?? ""}
                onChange={(e) => onChange(q.key, e.target.value)}
                className={cls}
              />
            ) : q.kind === "choice" ? (
              <select
                value={value}
                onChange={(e) => onChange(q.key, e.target.value)}
                className={`${cls} ${value ? "" : "text-ink-900/45"}`}
              >
                <option value="">{q.hint ?? "Choose…"}</option>
                {q.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : q.kind === "yes_no" ? (
              // Two buttons rather than a checkbox, because a checkbox has no
              // way to say "nobody has answered this yet" — and unticked
              // reads as "no" to everyone who looks at it afterwards.
              <div className="flex gap-2">
                {[YES, NO].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(q.key, value === opt ? "" : opt)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                      value === opt
                        ? "bg-ink-950 text-paper-50"
                        : "bg-ink-950/5 text-ink-900/70 hover:bg-ink-950/10"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={q.kind === "number" ? "number" : q.kind === "date" ? "date" : "text"}
                inputMode={q.kind === "number" ? "decimal" : undefined}
                value={value}
                placeholder={q.kind === "date" ? undefined : (q.hint ?? "")}
                onChange={(e) => onChange(q.key, e.target.value)}
                className={cls}
              />
            )}

            {/* The hint is the placeholder where there is a placeholder to
                be. Where there isn't one, it still has to be somewhere. */}
            {q.hint && (q.kind === "date" || q.kind === "yes_no") && (
              <span className="text-[11px] font-normal normal-case tracking-normal text-ink-900/45">
                {q.hint}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
