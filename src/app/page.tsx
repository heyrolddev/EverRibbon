import { duration, formatDate, money, shopToday } from "@/lib/format";
import { brand, RAMPS, STEPS } from "../../config/index.ts";

/*
 * A proof, not a homepage.
 *
 * Nothing here is the real shopfront — it exists so that `npm run build`
 * fails if the config layer ever stops working, and so the first thing anyone
 * sees on a fresh clone is the system reporting which shop it is serving.
 */
export default function Home() {
  const facts: [string, string][] = [
    ["Shop", brand.name],
    ["Locale", brand.locale],
    ["Time zone", brand.timeZone],
    ["Today, here", formatDate(new Date()) + `  (${shopToday()})`],
    ["Money", money(1234.5) + " · " + money(-1.25)],
    ["Duration", duration(185)],
    ["Fulfillment", brand.fulfillment],
    ["Accent block", `${brand.roles.accentFill} under ${brand.roles.onAccent}`],
  ];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
          Configuration check
        </p>
        <h1 className="font-display text-4xl leading-none font-bold">{brand.name}</h1>
        <p className="text-[var(--fg-muted)]">{brand.tagline}</p>
      </header>

      <div className="h-[3px] w-20 bg-[var(--accent-fill)]" />

      <dl className="flex flex-col">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-[var(--line)] py-2.5">
            <dt className="text-sm text-[var(--fg-faint)]">{k}</dt>
            <dd className="tabular font-mono text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-1.5" aria-hidden>
        {RAMPS.map((name) => (
          <div key={name} className="flex flex-1 flex-col gap-px" title={name}>
            {STEPS.map((step) => (
              <div key={step} className="h-3" style={{ background: `var(--${name}-${step})` }} />
            ))}
          </div>
        ))}
      </div>

      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--fg-faint)]">
        Every value above was read from <code className="font-mono">config/brands/{brand.key}.ts</code>.
        Nothing in <code className="font-mono">src/</code> names this shop, its currency, its timezone
        or its colours — which is what makes the next shop a config file rather than a fork.
      </p>
    </main>
  );
}
