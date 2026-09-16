"use client";

import { createContext, useContext } from "react";
import type { SpecQuestion } from "@/lib/spec";

/**
 * What the shop asks, handed down to the order board.
 *
 * A context rather than a prop threaded through the board, the archive
 * results and two kinds of row: every one of those would have to carry a
 * value it does not use, and the one that gets missed is the one where
 * somebody cannot correct an answer.
 *
 * The default is an empty list — the same thing a shop that asks nothing
 * has — so a card rendered outside this provider shows the answers it
 * already has and offers no form, rather than throwing.
 */
const Ctx = createContext<SpecQuestion[]>([]);

export function SpecQuestionsProvider({
  questions,
  children,
}: {
  questions: SpecQuestion[];
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={questions}>{children}</Ctx.Provider>;
}

export const useSpecQuestions = () => useContext(Ctx);
