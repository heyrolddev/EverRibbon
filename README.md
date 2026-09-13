# Storefront template

An ordering and back-office system for a small made-to-order shop: catalogue,
orders, costing, stock, cash and the books. It runs one business today and is
built to run the next one from a config file rather than a fork.

The first shop it runs is configured in `config/brands/`.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in
npm run dev
```

```bash
npm test          # node's own runner, no framework, no transpile step
npm run typecheck
npm run lint
npm run check     # all three, which is what CI runs
```

## The one rule

**`src/` may read the config. It may never contain a shop's name, its currency
symbol, its timezone, its locale, or a colour.**

Those five are what every business changes. Each is cheap to inline and
expensive to extract later — the system this one grew from accumulated 115
brand strings across 54 files, 18 hardcoded timezones and six separate copies
of the same money formatter, none of which was ever a decision.

So the rule is a test, not a habit: `tests/no-brand-literals.test.ts` fails the
build. A genuine exception stays possible — put `brand-literal-ok` in a comment
on the line, which leaves every exception visible in a diff and greppable.

## How a colour reaches the screen

```
config/brands/<shop>.ts     "brand-400": "#C9A227"
        │
        ├─ layout.tsx   injects  :root { --brand-400: #C9A227 }   ← per render
        │
        └─ globals.css  @theme { --color-brand-400: var(--brand-400) }
                                                    ↑ no value, ever
                        .bg-brand-400 { background: var(--color-brand-400) }
```

The indirection is the point. Colours are injected at render rather than
compiled in, so one build can serve any shop and a theme can change without a
deploy. Verified by the build: the compiled CSS bundle contains no palette hex
at all.

Components read **roles** (`--accent`, `--ground`, `--fg-muted`), never the
ramp. A component that reaches past that layer for `paper-50` is a component
that breaks in dark mode.

## Adding a shop

1. Copy `config/brands/example.ts` to `config/brands/<key>.ts`.
2. Register it in `config/index.ts`.
3. Set `NEXT_PUBLIC_BRAND=<key>`.
4. `npm test`.

Step 4 is not a formality. `tests/palette.test.ts` fails a palette whose text
cannot be read — 4.5:1 for text, 3:1 for borders, in **both** themes — and
fails one whose warning colour is too close to the brand to read as a warning.
Handing a colour picker to a shop owner without that check means the first
buyer who loves pale gold ships prices nobody can read in daylight, and neither
of you finds out until a customer gives up on the order form.

## Layout

```
config/          what a shop is. The only place a brand fact may live.
  schema.ts        the type, and validation that runs at import
  brands/          one file per shop
src/
  app/             routes, and globals.css — tokens, no values
  lib/format.ts    money, dates, durations, in the shop's own terms
tests/           node --test. Includes the two guards above.
```
