import { brand } from "../../../../config/index.ts";
import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { getSchedule } from "@/lib/hours-server";
import { HoursEditor, TodayLine } from "@/components/hours-editor";
import { hqTitle } from "@/lib/hq-theme";

export default async function AdminHoursPage() {
  const viewer = await getViewer();
  // Hidden from the sidebar too, but hiding a link is not a permission:
  // a bookmark reaches this page all the same.
  if (!can(viewer, "settings")) {
    return <NotAllowed>Opening hours are set by the owner. If the shop needs to close early, tell them — it changes what customers can order.</NotAllowed>;
  }

  const schedule = await getSchedule();

  if (!schedule.configured) {
    return (
      <div className="rounded-3xl bg-accent-50 p-8 ring-1 ring-accent-200/40">
        <h2 className={hqTitle}>Opening hours</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-900/70">
          Run <strong>migration 0013</strong> in the Supabase SQL Editor to switch
          this on. Until then the shop is treated as always open — orders can
          land at any hour and Ask {brand.name} has to tell people to ring up.
        </p>
      </div>
    );
  }

  const { state } = schedule;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>Opening hours</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-900/60">
          These drive everything: whether the site takes an order right now, what
          Ask {brand.name} tells people, and which times an advance order can be
          booked for.
        </p>
      </div>

      <div
        className={`flex flex-wrap items-center gap-4 rounded-2xl p-5 ring-2 ${
          state.isOpen
            ? "bg-ok-50 ring-ok-600/40"
            : "bg-brand-50 ring-brand-700/40"
        }`}
      >
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${
            state.isOpen ? "animate-pulse bg-ok-600" : "bg-brand-700"
          }`}
        />
        <div>
          <p
            className={`font-display text-xl font-black ${
              state.isOpen ? "text-ok-700" : "text-brand-800"
            }`}
          >
            {state.isOpen ? "Open right now" : "Closed right now"}
          </p>
          <p className="text-sm text-ink-900/65">
            {state.reason ?? <TodayLine day={state.today} />}
            {state.opensNext && ` · ${state.opensNext}`}
          </p>
        </div>
      </div>

      <HoursEditor
        hours={schedule.hours}
        closures={schedule.closures}
        settings={schedule.settings}
      />
    </div>
  );
}
