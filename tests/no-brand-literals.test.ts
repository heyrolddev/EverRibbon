import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BRANDS, resolveBrand } from "../config/index.ts";

/**
 * The rule that makes this a template instead of one shop's website.
 *
 * `src/` may read the config. It may not contain a shop's name, its currency
 * symbol, its timezone, its locale, or a colour. Those five things are what
 * every business changes, and every one of them is cheap to inline and
 * expensive to extract later — the system this one grew from accumulated 115
 * brand strings across 54 files, 18 hardcoded timezones and six separate
 * copies of the same money formatter, none of which were a decision.
 *
 * Nobody remembers a rule like this at 1am. So it is a test.
 *
 * An exception that is genuinely right stays possible: put `brand-literal-ok`
 * in a comment on the line. That leaves every exception visible in a diff and
 * greppable, which is the opposite of how the last 115 got there.
 */

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".css", ".js", ".jsx", ".mjs"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return EXTS.some((e) => full.endsWith(e)) ? [full] : [];
  });
}

/**
 * Strip comments, tracking block comments across lines.
 *
 * The split matters: a comment reading `₱1,234.50 — two decimals` is
 * documentation and should stay, while a shop's NAME in prose is a fact about
 * one business that does not belong in shared code either way. So brand names
 * are banned everywhere and the rest is checked against code only.
 */
function codeLines(source: string): string[] {
  let inBlock = false;
  return source.split("\n").map((line) => {
    let out = "", i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", i);
        if (end === -1) return out;
        inBlock = false; i = end + 2; continue;
      }
      const block = line.indexOf("/*", i);
      const slash = line.indexOf("//", i);
      if (slash !== -1 && (block === -1 || slash < block)) return out + line.slice(i, slash);
      if (block !== -1) { out += line.slice(i, block); inBlock = true; i = block + 2; continue; }
      return out + line.slice(i);
    }
    return out;
  });
}

/** Built from the registry, so a new brand is covered the moment it is added. */
function banned(): { re: RegExp; why: string; prose: boolean }[] {
  const out: { re: RegExp; why: string; prose: boolean }[] = [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const b of Object.values(BRANDS)) {
    // Banned in prose too: a comment about one shop is wrong in every other.
    out.push({ re: new RegExp(esc(b.name), "i"), prose: true,
      why: `the shop name "${b.name}" — read it from config` });
    out.push({ re: new RegExp(esc(b.currency.symbol)), prose: false,
      why: `the currency symbol "${b.currency.symbol}" — use money() from src/lib/format` });
    out.push({ re: new RegExp(esc(b.timeZone)), prose: false,
      why: `the timezone "${b.timeZone}" — the formatters in src/lib/format already pin it` });
    out.push({ re: new RegExp(`["'\`]${esc(b.locale)}["'\`]`), prose: false,
      why: `the locale "${b.locale}" — read brand.locale` });
  }
  out.push({ re: /#[0-9a-fA-F]{6}\b/, prose: false,
    why: "a hex colour — every colour is a token, see src/app/globals.css" });
  out.push({ re: /\btoLocaleString\(\s*["'][a-z]{2}-[A-Z]{2}["']/, prose: false,
    why: "a hardcoded locale in toLocaleString — use src/lib/format" });
  return out;
}

const files = walk(SRC);

test("src/ contains no brand name, currency, timezone, locale or colour", () => {
  const rules = banned();
  const hits: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const raw = source.split("\n");
    const code = codeLines(source);
    raw.forEach((line, i) => {
      if (/brand-literal-ok/.test(line)) return;
      for (const { re, why, prose } of rules) {
        const subject = prose ? line : code[i] ?? "";
        if (re.test(subject)) {
          hits.push(`${relative(ROOT, file)}:${i + 1} — ${why}\n    ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }

  assert.equal(
    hits.length, 0,
    `src/ has ${hits.length} hardcoded brand value(s):\n\n${hits.join("\n")}\n`
  );
});

test("the guard is actually looking at files", () => {
  // A walk that silently returns nothing would make the test above pass
  // forever while checking nothing at all — the classic dead guard.
  assert.ok(files.length >= 3, `expected to scan several files, scanned ${files.length}`);
  assert.ok(files.some((f) => f.endsWith(".css")), "stylesheets must be scanned too");
  assert.ok(files.some((f) => f.endsWith(".tsx")), "components must be scanned too");
});

test("the guard would catch a real leak", () => {
  const rules = banned();
  const smuggled = [
    `const shop = "EverRibbon";`,
    `const label = "₱" + n.toFixed(2);`,
    `timeZone: "Asia/Manila",`,
    `background: "#C9A227",`,
  ];
  for (const line of smuggled) {
    assert.ok(rules.some(({ re }) => re.test(line)), `should have been caught: ${line}`);
  }
});

test("documentation is allowed to name a format, code is not", () => {
  const rules = banned();
  const symbol = resolveBrand("everribbon").currency.symbol;
  const check = (src: string) => {
    const code = codeLines(src);
    return src.split("\n").some((line, i) =>
      rules.some(({ re, prose }) => re.test(prose ? line : code[i] ?? ""))
    );
  };
  assert.equal(check(`// prints as ${symbol}1,234.50\nreturn fmt(n);`), false, "a comment may show the format");
  assert.equal(check(`/*\n * like ${symbol}1.25\n */\nreturn fmt(n);`), false, "a block comment may too");
  assert.equal(check(`const s = "${symbol}" + n;`), true, "code may not");
  assert.equal(check(`const x = 1; // a shop called EverRibbon`), true, "a shop name is banned in prose as well");
});
