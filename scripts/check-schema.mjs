/**
 * Load the baseline schema into a throwaway Postgres and assert what must hold.
 *
 * A migration that does not run is not a migration, and the only way to know
 * is to run it. Doing that here rather than against the shop's database means
 * a broken schema is a red build instead of an evening.
 *
 *     DATABASE_URL=postgres://... node scripts/check-schema.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }

const psql = (args, input) =>
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
const scalar = (sql) => psql(["-tAc", sql]).trim();

console.log("loading platform shim...");
psql(["-f", "supabase/test-shim.sql"]);

const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const m of migrations) {
  psql(["-f", join("supabase/migrations", m)]);
  console.log(`  ok  ${m}`);
}

/** What the schema must be true of, whatever else changes. */
const checks = [
  ["every table has row-level security enabled",
   "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
   "where n.nspname='public' and c.relkind='r' and not c.relrowsecurity", "0",
   "A table without RLS is readable by any signed-in customer."],

  ["no table is left without a policy",
   "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
   "where n.nspname='public' and c.relkind='r' and c.relrowsecurity " +
   "and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)", "0",
   "RLS on with no policy denies everyone, which is safe but usually a mistake."],

  ["the access helpers exist",
   "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace " +
   "where n.nspname='public' and p.proname in ('is_staff','is_owner','is_manager')", "3",
   "Every policy asks one of these; without them nothing is enforced."],

  ["the catalogue is in the generic vocabulary",
   "select count(*) from information_schema.tables where table_schema='public' " +
   "and table_name in ('products','materials','product_materials','product_components','production_runs')", "5",
   "These five carry the costing model and must not be shop-specific."],

  ["nothing food-shaped survived the rename",
   "select count(*) from information_schema.tables where table_schema='public' " +
   "and (table_name like '%meal%' or table_name like '%ingredient%' or table_name like '%batch%' or table_name like '%menu%')", "0",
   "A table named after one trade is a table the next buyer has to explain away."],

  ["no column is food-shaped either",
   "select count(*) from information_schema.columns where table_schema='public' " +
   "and (column_name like '%meal%' or column_name like '%ingredient%' or column_name like '%dish%')", "0",
   "Columns outlive tables in queries; a stray meal_id would spread."],
];

let failed = 0;
console.log("");
for (const [what, sql, want, why] of checks) {
  const got = scalar(sql);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `  (got ${got}, want ${want})\n       ${why}`}`);
}

console.log(`\n  tables ${scalar("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")}` +
            `  policies ${scalar("select count(*) from pg_policies where schemaname='public'")}` +
            `  foreign keys ${scalar("select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'")}`);

if (failed) { console.error(`\n${failed} schema check(s) failed.\n`); process.exit(1); }
console.log("\nschema is sound.\n");
