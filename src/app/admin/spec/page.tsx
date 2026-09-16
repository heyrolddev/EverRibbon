import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpecQuestions } from "@/lib/spec-server";
import { SpecEditor } from "@/components/spec-editor";
import { hqTitle } from "@/lib/hq-theme";

/**
 * What the shop asks about a job.
 *
 * The screen behind `order_lines.spec`. A quote line says "3-stem bouquet,
 * ₱850" — enough to charge for, nowhere near enough to make. The questions
 * here are what turn it into something that can be cut, printed and
 * photographed without anyone going back to the customer to ask which colour
 * they meant.
 *
 * Rows rather than a list in the code, because a ribbon shop asks about
 * stems and printed names and a cake shop asks about flavour and the message
 * on top — and neither should need a developer to add a question.
 */
export default async function AdminSpecPage() {
  const viewer = await getViewer();
  if (!can(viewer, "settings")) {
    return (
      <NotAllowed>
        A question marked &ldquo;must be answered&rdquo; can stop a quote being
        saved, so what the shop asks is kept to the owner. Taking orders and
        answering these questions is unaffected.
      </NotAllowed>
    );
  }

  const supabase = await createClient();
  const [questions, categories] = await Promise.all([
    getSpecQuestions(),
    supabase.from("catalog_categories").select("name").order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>What to ask</h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/70">
          The questions that turn &ldquo;a bouquet&rdquo; into a thing somebody
          can actually make. They appear on the quote desk as you price a job,
          and the answers travel with the order — onto the board, onto the
          person taking the proof photo, and onto the customer&apos;s own page,
          so all three are reading the same words.
        </p>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/55">
          Aim a question at one category and it is only asked about that kind
          of work. Leave it on <strong>Every job</strong> and it is always
          asked. Reword one whenever you like — orders already taken keep the
          wording they were taken with.
        </p>
      </div>

      <SpecEditor
        questions={questions}
        categories={(categories.data ?? []).map((c) => String(c.name))}
      />
    </div>
  );
}
