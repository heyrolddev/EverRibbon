import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/auth";
import { isSpecKind, type SpecQuestion } from "@/lib/spec";

/**
 * What this shop asks, read once per request.
 *
 * Empty is a real answer, not a failure. A shop that sells only from a
 * catalogue asks nothing extra, and every screen here is built to show
 * nothing at all rather than an empty heading — so there is no fallback list
 * to fall back to, and no reason to invent one.
 */
export const getSpecQuestions = cache(async (): Promise<SpecQuestion[]> => {
  if (!isConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("spec_questions")
      // One string literal: the column list is what the row type is inferred
      // from, and a joined string infers as nothing.
      .select("id, key, label, hint, kind, options, required, category, sort_order, is_active")
      .order("sort_order")
      .order("id");
    // A database that has not run 0020 has no such table. No questions is the
    // same screen as no table, which is the right screen for both.
    if (error || !data) return [];

    return data.map((r) => ({
      id: Number(r.id),
      key: String(r.key),
      label: String(r.label),
      hint: r.hint == null ? null : String(r.hint),
      kind: isSpecKind(r.kind) ? r.kind : "text",
      options: Array.isArray(r.options) ? r.options.map(String) : [],
      required: Boolean(r.required),
      category: r.category == null ? null : String(r.category),
      sortOrder: Number(r.sort_order) || 0,
      isActive: Boolean(r.is_active),
    }));
  } catch {
    return [];
  }
});
