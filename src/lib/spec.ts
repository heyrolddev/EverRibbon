/**
 * The answers that make a line the thing it is.
 *
 * A quote line says "3-stem bouquet, ₱850". That is enough to charge for and
 * not nearly enough to make: which colours, whose name, spelled how, what
 * goes on the card. Without somewhere to put those answers they live in a
 * chat thread, and the person cutting the ribbon is not in the chat thread.
 *
 * Two shapes, and the distance between them is the whole design:
 *
 *   SpecQuestion   what this shop asks. Rows in a table, owner-editable.
 *   SpecAnswer     what one customer said, stored on the order line —
 *                  WITH the question's wording copied in beside it.
 *
 * That copy is the part worth defending. An answer filed only under a key is
 * an answer that becomes unreadable the day the question is reworded, and a
 * question WILL be reworded — that is the point of making them editable. An
 * order from March has to still say what was agreed in March.
 *
 * Pure, so the quote desk, the order board, the customer's own page and a
 * test all read a spec the same way.
 */

/**
 * What kind of answer a question takes.
 *
 * This chooses the control on the screen and nothing else. Every answer is
 * stored and shown as text, because a number here ends up printed on a
 * ribbon: 12 and "12" are the same ribbon, and the second one never arrives
 * as 11.999999999999998.
 */
export type SpecKind = "text" | "long_text" | "number" | "choice" | "date" | "yes_no";

export const SPEC_KINDS: { kind: SpecKind; label: string; hint: string }[] = [
  { kind: "text", label: "Short answer", hint: "A name, a colour, a size" },
  { kind: "long_text", label: "Long answer", hint: "A message, an address, instructions" },
  { kind: "number", label: "Number", hint: "How many stems, how many metres" },
  { kind: "choice", label: "Pick one", hint: "From a list you set" },
  { kind: "date", label: "Date", hint: "A ceremony date, a birthday" },
  { kind: "yes_no", label: "Yes or no", hint: "Gift wrapped? Rush cut?" },
];

export const isSpecKind = (v: unknown): v is SpecKind =>
  SPEC_KINDS.some((k) => k.kind === v);

export type SpecQuestion = {
  id: number;
  /** Stable, slug-shaped. The key the answer is filed under. */
  key: string;
  label: string;
  hint: string | null;
  kind: SpecKind;
  /** For `choice`. Empty for everything else. */
  options: string[];
  required: boolean;
  /** The catalogue category this is asked about, or null for every job. */
  category: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SpecAnswer = {
  key: string;
  /** The question as it was worded when this was answered. */
  label: string;
  value: string;
};

export const YES = "Yes";
export const NO = "No";

/* ------------------------------------------------------------- reading -- */

const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? YES : NO;
  return "";
};

/**
 * Turn a slug back into something a person can read.
 *
 * Only ever used on an answer that arrived without its label — a spec typed
 * straight into the SQL editor, or written by an importer. A guessed heading
 * is worse than the real one and far better than showing somebody
 * `name_on_ribbon`.
 */
export const humanise = (key: string): string => {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
};

/** A label a person typed, as a key this can file an answer under. */
export const slugify = (label: string): string =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "q$1")
    .slice(0, 40);

const answerOf = (raw: unknown, fallbackKey?: string): SpecAnswer | null => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const key = text(r.key) || fallbackKey || "";
    const value = text(r.value);
    if (!key || !value) return null;
    return { key, label: text(r.label) || humanise(key), value };
  }
  const value = text(raw);
  if (!fallbackKey || !value) return null;
  return { key: fallbackKey, label: humanise(fallbackKey), value };
};

/**
 * Whatever is in the column, as answers.
 *
 * Deliberately forgiving, because this column is reachable from the SQL
 * editor and from any importer anybody writes later. It accepts the shape
 * this app writes, a bare array, and a plain `{key: value}` object — and
 * returns an empty list for anything it cannot make sense of, because a line
 * with an unreadable spec should still print its name and price rather than
 * take the order board down.
 */
export function parseSpec(raw: unknown): SpecAnswer[] {
  if (!raw) return [];

  let source: unknown = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const wrapped = (source as Record<string, unknown>).answers;
    if (Array.isArray(wrapped)) source = wrapped;
  }

  const out: SpecAnswer[] = [];
  const seen = new Set<string>();
  const push = (a: SpecAnswer | null) => {
    if (!a || seen.has(a.key)) return;
    seen.add(a.key);
    out.push(a);
  };

  if (Array.isArray(source)) {
    for (const entry of source) push(answerOf(entry));
  } else if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      push(answerOf(value, key));
    }
  }
  return out;
}

/** True when there is nothing worth showing. */
export const hasSpec = (answers: SpecAnswer[]): boolean => answers.length > 0;

/** One answer, by the key it is filed under. */
export const answerFor = (answers: SpecAnswer[], key: string): string | null =>
  answers.find((a) => a.key === key)?.value ?? null;

/* ------------------------------------------------------------- writing -- */

/**
 * What to store in the column.
 *
 * Null when nothing was answered, so an untouched line holds NULL rather than
 * an empty envelope — the difference between "nothing was asked" and "asked
 * and left blank" is visible in the data, and only one of them is a mistake.
 */
export function specJson(answers: SpecAnswer[]): { answers: SpecAnswer[] } | null {
  const kept = answers.filter((a) => a.key && a.value.trim());
  return kept.length === 0 ? null : { answers: kept };
}

/**
 * The questions to ask about a particular job.
 *
 * A question with no category is asked about everything; one with a category
 * is asked only when the line belongs to it. Retired questions are left out,
 * which is what retiring one means — the answers already given to it stay on
 * the orders that carry them.
 */
export function questionsFor(
  questions: SpecQuestion[],
  categories: string[] = []
): SpecQuestion[] {
  const on = new Set(categories.map((c) => c.trim()).filter(Boolean));
  return questions
    .filter((q) => q.isActive && (q.category === null || on.has(q.category)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * Which kinds of work a set of answers must have been asked about.
 *
 * The line does not store what it was: only the answers, and those carry the
 * question's wording rather than its scope. So when an enquiry is reopened to
 * be priced, this works backwards — any category whose questions include one
 * that was actually answered.
 *
 * It is a reconstruction and it is allowed to be. Getting it wrong offers a
 * couple of extra questions on a form; not doing it at all drops every
 * category-scoped answer the customer already gave.
 */
export function categoriesForAnswers(
  questions: SpecQuestion[],
  answers: SpecAnswer[]
): string[] {
  const given = new Set(answers.map((a) => a.key));
  return [
    ...new Set(
      questions
        .filter((q) => q.category !== null && given.has(q.key))
        .map((q) => q.category as string)
    ),
  ].sort();
}

/** Answers as the form holds them, keyed by question. */
export const valuesOf = (answers: SpecAnswer[]): Record<string, string> =>
  Object.fromEntries(answers.map((a) => [a.key, a.value]));

/** Every category any question is scoped to, for the editor's dropdown. */
export const scopedCategories = (questions: SpecQuestion[]): string[] =>
  [...new Set(questions.map((q) => q.category).filter((c): c is string => Boolean(c)))].sort();

/**
 * Typed-in values, as answers to store.
 *
 * Built in question order and carrying each question's current wording, so
 * the order reads as a form that was filled in rather than as a bag of keys.
 * Blanks are dropped: an unanswered optional question is not a fact.
 */
export function answersFrom(
  questions: SpecQuestion[],
  values: Record<string, string>
): SpecAnswer[] {
  const out: SpecAnswer[] = [];
  for (const q of questions) {
    const value = (values[q.key] ?? "").trim();
    if (!value) continue;
    // A choice that is not on the list is not that choice. Somebody editing
    // the options should not leave old answers looking like current ones.
    if (q.kind === "choice" && q.options.length > 0 && !q.options.includes(value)) continue;
    out.push({ key: q.key, label: q.label, value });
  }
  return out;
}

/** The questions that have to be answered and have not been. */
export const missingRequired = (
  questions: SpecQuestion[],
  values: Record<string, string>
): SpecQuestion[] =>
  questions.filter((q) => q.required && !(values[q.key] ?? "").trim());

/* ------------------------------------------------------------ showing -- */

/**
 * The spec on one line, where there is room for one line.
 *
 * Labels included, because "12 · Maroon · Krizzia" out of context is three
 * facts about nothing. Truncated with a count rather than an ellipsis so the
 * reader knows there is more and how much more.
 */
export function specSummary(answers: SpecAnswer[], max = 3): string {
  if (answers.length === 0) return "";
  const shown = answers.slice(0, max).map((a) => `${a.label}: ${a.value}`);
  const rest = answers.length - shown.length;
  return shown.join(" · ") + (rest > 0 ? ` · +${rest} more` : "");
}

/**
 * The same thing, for a printed ticket.
 *
 * One answer per line and no truncation: the ticket is what goes to the
 * bench, and a spec abbreviated to fit is the reason the wrong thing gets
 * made.
 */
export const specLines = (answers: SpecAnswer[]): string[] =>
  answers.map((a) => `${a.label}: ${a.value}`);
