"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";
import { getSpecQuestions } from "@/lib/spec-server";
import { answersFrom, parseSpec, questionsFor, specJson } from "@/lib/spec";

/**
 * Changing what was agreed, after it was agreed.
 *
 * "Pinalitan niya ang kulay" is not an edge case in this trade, it is a
 * Tuesday. Without this the correction lives in a chat thread and the person
 * at the bench works from the order card, which still says maroon.
 *
 * Two things this is careful about:
 *
 *   The wording is read from the questions table here, never taken from the
 *   browser — same rule as the quote's prices.
 *
 *   An answer whose question has since been retired is left exactly as it
 *   was. It is not on the form, so the form cannot be evidence that anybody
 *   meant to clear it.
 */
export async function saveLineSpec(input: {
  lineId: number;
  /** The catalogue categories of this line, which decide what is asked. */
  categories: string[];
  /** Answers as typed, keyed by question. */
  values: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(await getViewer(), "orders")) {
    return { ok: false, error: "You can't change orders." };
  }

  const supabase = await createClient();
  const [questions, { data: line, error: readError }] = await Promise.all([
    getSpecQuestions(),
    supabase.from("order_lines").select("id, order_id, spec").eq("id", input.lineId).single(),
  ]);

  if (readError || !line) {
    return { ok: false, error: readError?.message ?? "That line is gone." };
  }

  const stored = parseSpec(line.spec);
  // What is on the form: the questions this job is asked, plus any question
  // already answered on it — so an answer given before the question moved
  // category is still editable rather than stranded.
  const answered = new Set(stored.map((a) => a.key));
  const asked = questionsFor(questions, input.categories);
  const askedKeys = new Set(asked.map((q) => q.key));
  const onForm = [
    ...asked,
    // Still active, already answered here, but no longer scoped to this kind
    // of work. It is on the order, so it stays editable — a question the shop
    // moved to another category should not strand the answers it collected.
    ...questions.filter(
      (q) => q.isActive && answered.has(q.key) && !askedKeys.has(q.key)
    ),
  ];

  const edited = answersFrom(onForm, input.values);
  const editable = new Set(onForm.map((q) => q.key));
  // Anything the form never showed keeps its old answer, in its old place.
  const untouched = stored.filter((a) => !editable.has(a.key));

  const { error } = await supabase
    .from("order_lines")
    .update({ spec: specJson([...edited, ...untouched]) })
    .eq("id", input.lineId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  return { ok: true };
}
