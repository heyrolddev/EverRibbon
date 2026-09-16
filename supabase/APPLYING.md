# Applying the schema to a Supabase project

Run the files in `supabase/migrations/` in filename order. Nothing else.

```
0001_schema.sql                 tables, functions, views
0002_keys.sql                   primary keys, uniques, checks
0003_indexes.sql
0004_triggers.sql
0005_foreign_keys.sql
0006_row_level_security.sql     RLS on every table, then the policies
0007_order_statuses_as_data.sql the steps an order goes through
0008_units_labour_and_capacity.sql
0009_required_rows.sql          the rows the app assumes exist
0010_realtime.sql               the four screens that update live
```

Then, for a shop that agrees the work before building it:

```
supabase/seeds/made-to-order-statuses.sql
```

## Do not run test-shim.sql

`supabase/test-shim.sql` builds a fake of the platform — `auth.uid()`,
`auth.users`, the storage tables, the realtime publication — so the schema can
be loaded into a plain Postgres and checked. Supabase provides all of it for
real. Running the shim there would try to create things that already exist.

It exists so `npm run check:schema` can prove the migrations apply without
touching anyone's database, which is also what CI does on every push.

## Two ways to run them

**The dashboard.** SQL Editor, one file at a time, in order. `0001_schema.sql`
is about 2,000 lines; if the editor baulks at the paste, use the CLI instead
rather than splitting the file.

**The CLI.** `supabase db push` applies everything in `supabase/migrations/`
in order, and records what it has applied so a second run is a no-op.

## Afterwards

Two keys from Project Settings → API go in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key>
SUPABASE_SERVICE_ROLE_KEY=<the service role key>
```

The first two are public — they ship in the browser bundle and are meant to.

The third is not, and the difference matters more than it looks: the service
role key **bypasses row-level security entirely**. Every row of every table,
for anyone holding it. It belongs in `.env.local` (which is gitignored) and in
the host's environment variables, and nowhere else — not in a commit, not in a
screenshot, not pasted into a chat. If one is ever exposed, roll it in Project
Settings → API rather than hoping.

## The rule from here

**Never edit a migration that has run.** Add a new one.

A migration that has been applied is a fact about a database somewhere, and
editing the file does not change that database — it only makes the file
disagree with it, which is worse than the original mistake.
