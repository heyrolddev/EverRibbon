# Working in this repo

Read `README.md` first — particularly **The one rule**.

## Before you commit

`npm run check` — typecheck, lint, tests. CI runs the same three and a build.

## Things that will bite

- **Next 16 is not the Next.js you may know.** `eslint-config-next` ships flat
  configs directly (`eslint-config-next/core-web-vitals`), so `FlatCompat`
  fails with a circular-structure error. When an API surprises you, read
  `node_modules/next/dist/docs/` rather than guessing.
- **`noUncheckedIndexedAccess` is on.** `obj[key]` is `T | undefined`. Narrow
  it; don't switch the flag off — it is the check that catches a missing
  palette key before a shop ships with an invisible button.
- **Never edit a migration that has run.** Add a new one.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security.** Never import it
  into a client component, never prefix it `NEXT_PUBLIC_`, never let it reach a
  browser bundle.
- **Money and dates go through `src/lib/format.ts`.** Not `toFixed(2)`, not a
  local `const peso`. That is how the last system ended up with six of them.

## Comments

Explain *why*, not *what*. The reason a line exists — the bug it prevents, the
decision behind it — is the thing that is expensive to recover later and
invisible in the diff. Match the density already here.
