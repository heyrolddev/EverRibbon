import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The schema may not name one trade either.
 *
 * scripts/check-schema.mjs asks this of a live database and is the stronger
 * check, but it needs Postgres. This one reads the files, so it runs in the
 * same suite as everything else and catches a stray `meal_id` the moment it
 * is typed rather than after a push.
 */
const DIR = new URL("../supabase/migrations", import.meta.url).pathname;
const FOOD = /\b(meals?|ingredients?|dish|dishes|menu_categories|batch(es)?_?\w*|consumption_log|waste_log|purchase_log)\b/i;

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

test("the baseline is not empty", () => {
  // A guard that scans nothing passes forever while checking nothing.
  assert.ok(files.length >= 5, `expected the baseline files, found ${files.length}`);
});

test("no migration names a food business", () => {
  const hits: string[] = [];
  for (const f of files) {
    readFileSync(join(DIR, f), "utf8").split("\n").forEach((line, i) => {
      const m = FOOD.exec(line);
      if (m) hits.push(`${f}:${i + 1} — "${m[0]}"\n    ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(hits, [], `the schema still speaks of food:\n${hits.join("\n")}`);
});

test("the five tables the costing model rests on are present", () => {
  const all = files.map((f) => readFileSync(join(DIR, f), "utf8")).join("\n");
  for (const t of ["products", "materials", "product_materials", "product_components", "production_runs"]) {
    assert.match(all, new RegExp(`CREATE TABLE public\\.${t} \\(`), `missing table ${t}`);
  }
});

test("every table that is created also has row-level security turned on", () => {
  // The live check in scripts/check-schema.mjs proves this properly; this one
  // catches the common case — a table added without the matching ENABLE line.
  const all = files.map((f) => readFileSync(join(DIR, f), "utf8")).join("\n");
  const created = [...all.matchAll(/CREATE TABLE public\.(\w+) \(/g)].map((m) => m[1]!);
  const secured = new Set([...all.matchAll(/ALTER TABLE public\.(\w+) ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]!));
  const missing = created.filter((t) => !secured.has(t));
  assert.deepEqual(missing, [], `tables created without RLS: ${missing.join(", ")}`);
});
