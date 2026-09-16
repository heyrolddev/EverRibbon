"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getViewer } from "@/lib/auth";
import { isSpecKind, slugify, type SpecKind } from "@/lib/spec";

/**
 * Changing what the shop asks.
 *
 * Owner-only, like prices and categories: a question marked required is a
 * question that can stop a quote being saved, so it is not a thing anyone
 * taking orders should be able to add mid-shift.
 *
 * Deleting one is genuinely safe here, and that is by design — every answer
 * already given carries the question's wording with it, so removing the row
 * cannot make an old order unreadable. Retiring exists for the other case:
 * a question the shop still wants the history of asking.
 */

export type QuestionDraft = {
  /** Absent for a new one. */
  id?: number;
  label: string;
  hint: string;
  kind: SpecKind;
  /** One per line, as typed. Only read for `choice`. */
  options: string[];
  required: boolean;
  category: string | null;
};

type Result = { ok: true; id: number } | { ok: false; error: string };

const MISSING = "Run migration 0020 in the Supabase SQL editor first.";

const fail = (message: string): { ok: false; error: string } => ({
  ok: false,
  error: message.includes("spec_questions") && message.includes("does not exist")
    ? MISSING
    : message,
});

/**
 * A key that is not already taken.
 *
 * The key is derived from the label rather than typed, because it is a JSON
 * key and nobody should have to think about that to add a question. Two
 * questions worded similarly enough to collide get a number rather than an
 * error — the owner asked for both, and the wording is what they will read.
 */
async function freeKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  label: string
): Promise<string> {
  const base = slugify(label) || "question";
  const { data } = await supabase
    .from("spec_questions")
    .select("key")
    .like("key", `${base}%`);
  const taken = new Set((data ?? []).map((r) => String(r.key)));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
  return `${base}_${Date.now()}`;
}

export async function saveQuestion(draft: QuestionDraft): Promise<Result> {
  if (!can(await getViewer(), "settings")) {
    return { ok: false, error: "Only the owner can change what the shop asks." };
  }

  const label = draft.label.trim();
  if (!label) return { ok: false, error: "Give the question some words." };
  if (!isSpecKind(draft.kind)) return { ok: false, error: "Pick a kind of answer." };

  const options = draft.options.map((o) => o.trim()).filter(Boolean);
  if (draft.kind === "choice" && options.length < 2) {
    // A dropdown with one option is a label, and one with none is a dead end
    // the person filling the form cannot get past.
    return { ok: false, error: "A pick-one question needs at least two choices." };
  }

  const supabase = await createClient();
  const row = {
    label,
    hint: draft.hint.trim() || null,
    kind: draft.kind,
    options: draft.kind === "choice" ? options : [],
    required: draft.required,
    category: draft.category?.trim() || null,
  };

  if (draft.id) {
    // The key is left alone on purpose. It is what already-stored answers are
    // filed under, and reworded questions are the ordinary case — the whole
    // reason each answer carries its own label.
    const { error } = await supabase.from("spec_questions").update(row).eq("id", draft.id);
    if (error) return fail(error.message);
    revalidatePath("/admin/spec");
    revalidatePath("/admin/quotes");
    return { ok: true, id: draft.id };
  }

  // New ones go on the end, where somebody who just typed one expects to
  // find it.
  const { data: last } = await supabase
    .from("spec_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("spec_questions")
    .insert({
      ...row,
      key: await freeKey(supabase, label),
      sort_order: (Number(last?.sort_order) || 0) + 10,
    })
    .select("id")
    .single();

  if (error || !data) return fail(error?.message ?? "The question could not be saved.");

  revalidatePath("/admin/spec");
  revalidatePath("/admin/quotes");
  return { ok: true, id: Number(data.id) };
}

/** Stop asking it, keep the record of having asked it. */
export async function setQuestionActive(
  id: number,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(await getViewer(), "settings")) {
    return { ok: false, error: "Only the owner can change what the shop asks." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("spec_questions")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/spec");
  revalidatePath("/admin/quotes");
  return { ok: true };
}

/**
 * Remove it entirely.
 *
 * Safe because answers are snapshotted with their wording: an order taken
 * last March still reads "Name on the ribbon: Krizzia" after this runs.
 */
export async function removeQuestion(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(await getViewer(), "settings")) {
    return { ok: false, error: "Only the owner can change what the shop asks." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("spec_questions").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/spec");
  revalidatePath("/admin/quotes");
  return { ok: true };
}

/**
 * Move one up or down.
 *
 * Written as a swap of two rows' `sort_order` rather than as a renumbering of
 * the list, so two people reordering at once cannot leave the list in an
 * order neither of them chose.
 */
export async function moveQuestion(
  id: number,
  direction: "up" | "down"
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(await getViewer(), "settings")) {
    return { ok: false, error: "Only the owner can change what the shop asks." };
  }
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("spec_questions")
    .select("id, sort_order")
    .order("sort_order")
    .order("id");
  if (error) return fail(error.message);

  const list = (rows ?? []).map((r) => ({ id: Number(r.id), sort: Number(r.sort_order) || 0 }));
  const i = list.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  const a = list[i];
  const b = list[j];
  // Already at the end. Nothing to report and nothing to do.
  if (!a || !b) return { ok: true };

  // Equal sort orders would swap to no effect, so they are spread first.
  const [aSort, bSort] = a.sort === b.sort ? [b.sort + (direction === "up" ? -1 : 1), b.sort] : [b.sort, a.sort];

  await Promise.all([
    supabase.from("spec_questions").update({ sort_order: aSort }).eq("id", a.id),
    supabase.from("spec_questions").update({ sort_order: bSort }).eq("id", b.id),
  ]);

  revalidatePath("/admin/spec");
  revalidatePath("/admin/quotes");
  return { ok: true };
}
