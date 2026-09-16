import type { SpecAnswer } from "@/lib/spec";

/**
 * What was agreed, as it was agreed.
 *
 * Read-only, and on every screen that shows the job: the order board, the
 * person about to photograph a proof, and the customer's own page. The same
 * words in all three places is the entire point — a spec that reads one way
 * to the shop and another to the customer is worse than no spec, because both
 * sides are now confident.
 *
 * Labels come from the stored answer, not from the questions table, so an
 * order taken in March still reads as it did in March.
 */
export function SpecList({
  answers,
  className = "",
}: {
  answers: SpecAnswer[];
  className?: string;
}) {
  if (answers.length === 0) return null;

  return (
    <dl
      className={`grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)] ${className}`}
    >
      {answers.map((a) => (
        <div key={a.key} className="contents">
          <dt className="font-bold uppercase tracking-widest text-ink-900/45">
            {a.label}
          </dt>
          {/* Wrapped rather than truncated. The thing being described here is
              usually a piece of text somebody is about to print, and the half
              of it that does not fit is the half that gets misspelled. */}
          <dd className="whitespace-pre-wrap break-words font-semibold text-ink-950">
            {a.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
