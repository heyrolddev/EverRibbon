/**
 * Carry a module over from the stall's codebase, de-branded on the way.
 *
 * The transformations here are the mechanical half of Phase 1. They are a
 * script rather than a hand edit for one reason: there are roughly 3,500 of
 * them, and a hand edit that is 99% accurate still leaves thirty-five wrong.
 *
 * What it cannot decide, it refuses to guess at — it leaves a marker and the
 * file fails `npm test` until a person has looked. A codemod that silently
 * half-converts is worse than no codemod, because the diff looks finished.
 *
 *     node scripts/port.mjs <relative/path.ts> [more...]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const FROM = process.env.PORT_FROM ?? "/home/user/heyrolddev/pepper-pan";
const TO = process.cwd();

/**
 * Old colour token to new, decided by measuring the two palettes against each
 * other rather than by matching the number. The stall calls its red a 600; on
 * a shared lightness curve that colour is a 700, and a port that trusted the
 * number would have shifted every button on every screen.
 */
export const TOKENS = JSON.parse(readFileSync(join(TO, "scripts/token-map.json"), "utf8"));

const RAMPS_OLD = "brand|gold|jade|chili|ink|cream";

/**
 * The vocabulary, in every casing the code writes it.
 *
 * The schema was renamed in the database (see supabase/migrations), so the
 * TypeScript has to follow or every query breaks. Longest first, because
 * `meal_ingredients` must not be eaten by `meal_id`, and each entry is
 * expanded to snake_case, camelCase and PascalCase because a codebase writes
 * the same idea three ways: meal_id in a query, mealId in a prop, Meal in a
 * type.
 *
 * `dish` is the odd one: it never named a table, only the English the
 * interface used for a menu item. It becomes `product` too, so the screens
 * stop telling a ribbon shop about its dishes.
 */
const WORDS = [
  ["meal_ingredients", "product_materials"], ["meal_components", "product_components"],
  ["meal_packaging", "product_packaging"], ["menu_categories", "catalog_categories"],
  ["batch_ingredients", "production_run_materials"], ["ingredient_lots", "material_lots"],
  ["consumption_log", "material_usage"], ["purchase_log", "purchases"],
  ["waste_log", "waste"], ["produce_batch", "produce_run"],
  ["batch_cost_per_unit", "production_run_cost_per_unit"],
  ["consume_ingredient", "consume_material"], ["restore_ingredient", "restore_material"],
  ["has_bought_meal", "has_bought_product"], ["batch_stock", "run_stock"],
  ["meal_id", "product_id"], ["ingredient_id", "material_id"], ["batch_id", "production_run_id"],
  ["meals", "products"], ["ingredients", "materials"], ["batches", "production_runs"],
  ["dishes", "products"], ["dish", "product"],
  ["meal", "product"], ["ingredient", "material"], ["batch", "production_run"],
];

const upperFirst = (w) => w[0].toUpperCase() + w.slice(1);
const camel = (w) => w.split("_").map((p, i) => (i ? upperFirst(p) : p)).join("");
const pascal = (w) => w.split("_").map(upperFirst).join("");

/** snake_case, camelCase and PascalCase for each pair, longest first. */
export const VOCAB = WORDS.flatMap(([a, b]) => [
  [a, b], [camel(a), camel(b)], [pascal(a), pascal(b)],
]).filter(([a], i, all) => all.findIndex(([x]) => x === a) === i)
  .sort((x, y) => y[0].length - x[0].length);

/** Just the words, for a file that is already here and only needs renaming. */
export function renameVocabulary(source) {
  let out = source;
  for (const [a, b] of VOCAB) {
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${a}(?![A-Za-z0-9_])`, "g"), b);
  }
  return out;
}

export function port(source, relPath) {
  const notes = [];
  let out = source;

  // 0. The vocabulary. Before anything else, because the colour map and the
  //    money rules below do not care what a table is called.
  for (const [a, b] of VOCAB) {
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${a}(?![A-Za-z0-9_])`, "g"), b);
  }

  // 1. Colour tokens, in class strings and anywhere else they appear.
  out = out.replace(new RegExp(`\\b(${RAMPS_OLD})-(\\d{2,3})\\b`, "g"), (whole, ramp, step) => {
    const mapped = TOKENS[`${ramp}-${step}`];
    if (!mapped) { notes.push(`unmapped colour token ${whole}`); return whole; }
    return mapped;
  });

  /*
   * 2. Local money formatters. Six copies of this existed; there is now one.
   *
   * The declaration has to be removed whole, up to its terminating semicolon.
   * Deleting only the first line leaves the body behind, and rule 3 below then
   * rewrites that orphan into something that does not parse — which is at
   * least a loud failure, but it cost two files before the pattern was clear.
   */
  out = out.replace(/^[ \t]*const\s+peso\w*\s*=[\s\S]*?;[ \t]*\n/gm, "");
  out = out.replace(/\bpesoRound\(/g, "moneyRound(");
  out = out.replace(/\bpeso\(/g, "money(");

  // 3. Currency symbols still sitting in code. Template literals are the
  //    common shape and convert cleanly; anything else is left for a person.
  out = out.replace(/`₱\$\{([^}]+)\}`/g, "money($1)");
  out = out.replace(/"₱"\s*\+\s*([A-Za-z0-9_.()]+)/g, "money($1)");

  // 4. Timezone and locale.
  out = out.replace(/timeZone:\s*"[A-Za-z]+\/[A-Za-z_]+",?\s*\n/g, "");
  out = out.replace(/new Intl\.(DateTimeFormat|NumberFormat)\(\s*"[a-z]{2}-[A-Z]{2}"/g,
    (m, kind) => `new Intl.${kind}(brand.locale`);
  out = out.replace(/\.toLocaleString\("[a-z]{2}-[A-Z]{2}"/g, ".toLocaleString(brand.locale");

  /*
   * 4b. Two modules moved.
   *
   * format-date.ts exported exactly the four names src/lib/format.ts does, so
   * it is a redirect. The money formatters used to live in the costing module
   * and now live beside the dates, which means an import naming them has to be
   * split rather than rewritten -- most files import a costing type from the
   * same line.
   */
  out = out.replace(/from "@\/lib\/format-date"/g, 'from "@/lib/format"');
  out = out.replace(
    /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/costing";/g,
    (whole, names) => {
      const all = names.split(",").map((n) => n.trim()).filter(Boolean);
      const moved = all.filter((n) => /^(money|moneyRound)$/.test(n.replace(/^type\s+/, "")));
      if (!moved.length) return whole;
      const kept = all.filter((n) => !moved.includes(n));
      const lines = [];
      if (kept.length) lines.push(`import { ${kept.join(", ")} } from "@/lib/costing";`);
      lines.push(`import { ${moved.join(", ")} } from "@/lib/format";`);
      return lines.join("\n");
    }
  );

  // 5. Import paths: this repo keeps config outside src/.
  out = out.replace(/from "@\/lib\//g, 'from "@/lib/');

  /*
   * What a script must not decide on its own.
   *
   * `brand` and `ink` name a ramp in BOTH palettes, so "does an old token
   * survive" cannot be asked by pattern alone — it has to be asked against the
   * set of tokens that are now valid. Getting this wrong the first time
   * flagged four files that were already correct, which is its own lesson: a
   * guard that cries wolf gets switched off.
   */
  const VALID = new Set(Object.values(TOKENS));
  const code = out.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

  for (const m of code.matchAll(new RegExp(`\\b(${RAMPS_OLD})-(\\d{2,3})\\b`, "g"))) {
    if (!VALID.has(m[0])) notes.push(`unmapped colour token ${m[0]}`);
  }
  for (const [re, why] of [
    [/₱/, "a currency symbol the script could not convert"],
    [/Asia\/[A-Za-z_]+|"[a-z]{2}-[A-Z]{2}"/, "a timezone or locale left in place"],
    [/Pepper Pan|PepperPan|pepper-pan/i, "the old shop's name"],
    [/(?<![A-Za-z0-9_])(meals?|ingredients?|dish(es)?|batch(es)?|Meal|Ingredient|Dish|Batch)(?![A-Za-z0-9_])/,
     "a word from the old trade the vocabulary map missed"],
  ]) {
    if (re.test(code)) notes.push(why);
  }

  /*
   * Import paths, worked out from where the file lands rather than guessed.
   * `src/lib/x.ts` reaches format.ts as "./format.ts"; `src/app/x.tsx` as
   * "../lib/format.ts"; and config always sits outside src/.
   */
  const dir = dirname(relPath);
  const rel = (target) => {
    const r = relative(dir, target).replace(/\\/g, "/");
    return r.startsWith(".") ? r : "./" + r;
  };

  // Wire up the shared formatters if the file now calls them.
  const needs = [];
  for (const fn of ["money", "moneyRound", "quantity", "formatDate", "formatDateTime", "formatDateTimeFull", "shopToday", "duration"]) {
    if (new RegExp(`\\b${fn}\\(`).test(out) && !new RegExp(`import[^;]*\\b${fn}\\b[^;]*from`).test(out)) needs.push(fn);
  }
  const header = [];
  if (needs.length) header.push(`import { ${needs.join(", ")} } from "${rel("src/lib/format.ts")}";`);
  if (/\bbrand\./.test(out) && !/import[^;]*\bbrand\b[^;]*from/.test(out)) {
    header.push(`import { brand } from "${rel("config/index.ts")}";`);
  }
  /*
   * Imports go AFTER any leading directive, never above it.
   *
   * `"use client"` only counts as a directive while it is the first statement
   * in the file. Prepend an import above it and it becomes a stray expression:
   * the component silently turns into a server component, which fails at
   * runtime on the first hook rather than at build time. Lint sees it as an
   * unused expression, which is a very quiet way to describe a broken page.
   */
  if (header.length) {
    const directive = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'])use (?:client|server)\1\s*;?[ \t]*\r?\n/.exec(out);
    const at = directive ? directive[0].length : 0;
    out = out.slice(0, at) + header.join("\n") + "\n" + out.slice(at);
  }

  return { out, notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: node scripts/port.mjs <relative/path.ts>..."); process.exit(1); }
  let flagged = 0;
  /*
   * Artwork that belongs to one shop and was deliberately left behind.
   *
   * A bulk run over "everything not here yet" reads a deleted file as one that
   * has not been carried over, and cheerfully brings the wok back. Naming them
   * is the difference between a decision and a file that keeps reappearing.
   */
  const DROPPED = new Set([
    "src/components/pan-loader.tsx",   // a flame leaping out of a pan
    "src/components/noodle-lift.tsx",  // chopsticks lifting noodles
  ]);

  const force = files.includes("--force");
  for (const rel of files.filter((f) => f !== "--force")) {
    if (DROPPED.has(rel)) {
      console.log(`  - ${rel.padEnd(34)} SKIPPED: one shop's artwork, deliberately not carried over.`);
      continue;
    }
    const src = readFileSync(join(FROM, rel), "utf8");
    const { out, notes } = port(src, rel);
    const target = join(TO, rel);

    /*
     * Never overwrite work a person has already done.
     *
     * Re-running the script over a file that was ported and then fixed by hand
     * silently throws the fixes away, and the diff looks like a port rather
     * than like a loss. It happened twice before this guard existed. A file
     * that already matches what the script would produce is untouched work and
     * safe to rewrite; anything else needs --force and a moment's thought.
     */
    if (existsSync(target) && readFileSync(target, "utf8") !== out && !force) {
      console.log(`  - ${rel.padEnd(34)} SKIPPED: already here and edited since. --force to overwrite.`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, out);
    const tag = notes.length ? `NEEDS A LOOK: ${[...new Set(notes)].join("; ")}` : "clean";
    if (notes.length) flagged++;
    console.log(`${notes.length ? "!" : " "} ${rel.padEnd(34)} ${tag}`);
  }
  console.log(`\n${files.length} ported, ${flagged} need a person.`);
}
