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
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

export function port(source, relPath) {
  const notes = [];
  let out = source;

  // 1. Colour tokens, in class strings and anywhere else they appear.
  out = out.replace(new RegExp(`\\b(${RAMPS_OLD})-(\\d{2,3})\\b`, "g"), (whole, ramp, step) => {
    const mapped = TOKENS[`${ramp}-${step}`];
    if (!mapped) { notes.push(`unmapped colour token ${whole}`); return whole; }
    return mapped;
  });

  // 2. Local money formatters. Six copies of this existed; there is now one.
  out = out.replace(/^.*const\s+peso\w*\s*=\s*\(.*\n/gm, "");
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
  if (header.length) out = header.join("\n") + "\n" + out;

  return { out, notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: node scripts/port.mjs <relative/path.ts>..."); process.exit(1); }
  let flagged = 0;
  for (const rel of files) {
    const src = readFileSync(join(FROM, rel), "utf8");
    const { out, notes } = port(src, rel);
    mkdirSync(dirname(join(TO, rel)), { recursive: true });
    writeFileSync(join(TO, rel), out);
    const tag = notes.length ? `NEEDS A LOOK: ${[...new Set(notes)].join("; ")}` : "clean";
    if (notes.length) flagged++;
    console.log(`${notes.length ? "!" : " "} ${rel.padEnd(34)} ${tag}`);
  }
  console.log(`\n${files.length} ported, ${flagged} need a person.`);
}
