/**
 * Load the baseline schema into a throwaway Postgres and assert what must hold.
 *
 * A migration that does not run is not a migration, and the only way to know
 * is to run it. Doing that here rather than against the shop's database means
 * a broken schema is a red build instead of an evening.
 *
 *     DATABASE_URL=postgres://... node scripts/check-schema.mjs
 */
import { readdirSync } from "node:fs";
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

  ["the singleton settings rows exist",
   "select count(*) from (select 1 from settings union all select 1 from shop_settings " +
   "union all select 1 from payment_settings union all select 1 from delivery_settings " +
   "union all select 1 from chat_settings) t", "5",
   "The code reads these with .single(); a missing row is an error on screen, not an empty form."],

  ["every weekday has an hours row",
   "select count(*) from shop_hours", "7",
   "Without them the hours editor has nothing to edit and the shop reads as closed."],

  ["the order statuses are rows, not a constant",
   "select count(*) from order_statuses", "7",
   "An empty list means no order can be given any status at all."],

  ["orders.status is a foreign key, not a CHECK",
   "select count(*) from pg_constraint where conname = 'orders_status_fkey' and contype = 'f'", "1",
   "A CHECK means adding a step needs a migration and a deploy."],

  ["the four live screens are subscribed",
   "select count(*) from pg_publication_tables where pubname='supabase_realtime' " +
   "and tablename in ('orders','chat_messages','chat_threads','staff_shifts')", "4",
   "Without these the order board, the tracker, the inbox and the shift list stop updating, silently."],

  ["a custom line can exist without a product",
   "select count(*) from pg_constraint where conname='order_lines_identified' and contype='c'", "1",
   "A made-to-order shop's first line has no product row; without this it cannot be saved at all."],

  ["no column is food-shaped either",
   "select count(*) from information_schema.columns where table_schema='public' " +
   "and (column_name like '%meal%' or column_name like '%ingredient%' or column_name like '%dish%')", "0",
   "Columns outlive tables in queries; a stray meal_id would spread."],
];

/**
 * Things a query has to actually DO.
 *
 * Structure is cheap to assert and easy to get wrong in ways structure cannot
 * see: `minutes_booked` joined products INNER for five migrations, which is
 * valid SQL, a valid schema, and silently reported a day full of custom work
 * as empty. So these run the function against rows and check the number.
 */
const behaviours = [
  ["the calendar counts a custom line", () => {
    psql(["-c", `
      insert into order_statuses (key, label, sort_order, is_open)
        values ('quoted_test', 'Quoted (test)', 900, true)
        on conflict (key) do nothing;
      insert into orders (id, date, status, scheduled_for)
        values ('ord_test', current_date, 'quoted_test', current_date);
      insert into order_lines (order_id, product_id, qty, price_at_sale, label, labour_minutes)
        values ('ord_test', null, 3, 400, '3-stem bouquet, ivory + gold', 16.2);
    `]);
    return scalar("select minutes_booked(current_date)");
  }, "48.6",
   "A line with no product must still book time, or the day fills while reading empty."],

  ["the calendar still counts a catalogue line", () => {
    psql(["-c", `
      insert into products (id, name, price, assembly_minutes)
        values ('prod_test', 'Test product', 100, 5);
      insert into order_lines (order_id, product_id, qty, price_at_sale)
        values ('ord_test', 'prod_test', 2, 100);
    `]);
    return scalar("select minutes_booked(current_date)");
  }, "58.6",
   "The product path must be unchanged: 48.6 from the custom line plus 2 x 5."],

  ["revenue survives a shop that has no step called 'completed'", () => {
    // The whole point of 0014. Seed the made-to-order steps, put a delivered
    // order behind a customer, and ask the view what they have spent. Keyed
    // to the name, this returns 0 — a busy shop reporting no sales, with
    // nothing in any log to say why.
    psql(["-f", "supabase/seeds/made-to-order-statuses.sql"]);
    psql(["-c", `
      insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111')
        on conflict (id) do nothing;
      insert into profiles (id, role) values
        ('11111111-1111-1111-1111-111111111111', 'customer')
        on conflict (id) do nothing;
      insert into orders (id, date, status, customer_id, revenue)
        values ('ord_spend', current_date, 'delivered',
                '11111111-1111-1111-1111-111111111111', 1742.25);
      insert into order_lines (order_id, product_id, qty, price_at_sale, label)
        values ('ord_spend', null, 1, 1742.25, 'Graduation bouquet');
    `]);
    return scalar("select total_spent::numeric(10,2) from customer_order_stats " +
                  "where customer_id = '11111111-1111-1111-1111-111111111111'");
  }, "1742.25",
   "Lifetime spend, best-seller lists and the review gate all hang off this."],

  ["every shop's steps name exactly one that means 'they have it'", () => {
    return scalar("select count(*) from order_statuses where is_fulfilled");
  }, "1",
   "None means no order ever counts as a sale; two means revenue is counted twice."],

  ["a fresh install inherits nobody's delivery pin", () => {
    // The same coordinates were written into this template three times, and
    // this was the copy that made the state unreachable: DEFAULT plus NOT
    // NULL, so every install measured deliveries from one shop's town and
    // could not be told otherwise.
    return scalar(
      "select coalesce(shop_lat::text, 'null') || ',' || " +
      "coalesce(shop_lng::text, 'null') from delivery_settings where id = 1"
    );
  }, "null,null",
   "A guessed origin does not fail — it quotes the wrong fee, every time."],

  ["half a delivery pin is refused", () => {
    try {
      psql(["-c", "update delivery_settings set shop_lat = 14.9, shop_lng = null where id = 1"]);
      return "accepted";
    } catch { return "refused"; }
  }, "refused",
   "One coordinate without the other is a point on the equator."],

  ["a line that is neither a product nor a description is refused", () => {
    try {
      psql(["-c", "insert into order_lines (order_id, product_id, qty, price_at_sale) " +
                  "values ('ord_test', null, 1, 10)"]);
      return "accepted";
    } catch { return "refused"; }
  }, "refused",
   "Otherwise a blank line prints as an empty row on the receipt and cannot be costed."],

  ["a question's key is a key a JSON reader can hold", () => {
    try {
      psql(["-c", "insert into spec_questions (key, label) values ('Name on ribbon', 'x')"]);
      return "accepted";
    } catch { return "refused"; }
  }, "refused",
   "The key is a JSON key on every answer filed under it; a space in it is a key somebody gets wrong."],

  ["a pick-one question with nothing to pick is refused", () => {
    try {
      psql(["-c", "insert into spec_questions (key, label, kind) values ('colour', 'Colour', 'choice')"]);
      return "accepted";
    } catch { return "refused"; }
  }, "refused",
   "A dropdown with no options is a dead end the person filling the form cannot get past."],

  ["renaming a category keeps the questions asked about it", () => {
    // The category's NAME is its key, so a rename is an UPDATE to the thing
    // every question points at. Without ON UPDATE CASCADE the questions
    // would quietly stop being asked and nothing would report it.
    psql(["-c",
      "insert into catalog_categories (name) values ('Sashes'); " +
      "insert into spec_questions (key, label, category) values ('sash_text', 'Text', 'Sashes'); " +
      "update catalog_categories set name = 'Sash Printing' where name = 'Sashes'"]);
    return scalar("select coalesce(category, 'DETACHED') from spec_questions where key = 'sash_text'");
  }, "Sash Printing",
   "A question that silently stops being asked is worse than one that was never written."],

  ["deleting a category widens its questions rather than deleting them", () => {
    psql(["-c", "delete from catalog_categories where name = 'Sash Printing'"]);
    return scalar("select coalesce(category, 'every job') from spec_questions where key = 'sash_text'");
  }, "every job",
   "Tidying the catalogue must not take the shop's own questions with it."],
];

let failed = 0;
console.log("");
for (const [what, sql, want, why] of checks) {
  const got = scalar(sql);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `  (got ${got}, want ${want})\n       ${why}`}`);
}

for (const [what, run, want, why] of behaviours) {
  let got;
  try { got = String(run()); } catch (e) { got = `threw: ${String(e.message).split("\n")[0]}`; }
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `  (got ${got}, want ${want})\n       ${why}`}`);
}

console.log(`\n  tables ${scalar("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")}` +
            `  policies ${scalar("select count(*) from pg_policies where schemaname='public'")}` +
            `  foreign keys ${scalar("select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'")}`);

if (failed) { console.error(`\n${failed} schema check(s) failed.\n`); process.exit(1); }
console.log("\nschema is sound.\n");
