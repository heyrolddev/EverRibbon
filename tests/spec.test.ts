import test from "node:test";
import assert from "node:assert/strict";
import {
  answerFor,
  answersFrom,
  hasSpec,
  humanise,
  missingRequired,
  parseSpec,
  questionsFor,
  scopedCategories,
  slugify,
  specJson,
  specLines,
  specSummary,
  type SpecQuestion,
} from "../src/lib/spec.ts";

const q = (over: Partial<SpecQuestion> = {}): SpecQuestion => ({
  id: 1,
  key: "stems",
  label: "How many stems",
  hint: null,
  kind: "number",
  options: [],
  required: false,
  category: null,
  sortOrder: 10,
  isActive: true,
  ...over,
});

/* ------------------------------------------------------------- reading -- */

test("nothing in the column is no answers, not a crash", () => {
  // This column is reachable from the SQL editor. Every shape of rubbish in
  // it has to render an order card, because the alternative is an order board
  // that one bad row takes down.
  for (const raw of [null, undefined, 0, "", "not json", [], {}, { answers: null }]) {
    assert.deepEqual(parseSpec(raw), []);
  }
});

test("the shape this app writes reads back exactly", () => {
  const stored = {
    answers: [
      { key: "stems", label: "How many stems", value: "12" },
      { key: "name", label: "Name on the ribbon", value: "Krizzia" },
    ],
  };
  assert.deepEqual(parseSpec(stored), stored.answers);
  assert.equal(answerFor(parseSpec(stored), "name"), "Krizzia");
  assert.equal(answerFor(parseSpec(stored), "colour"), null);
});

test("a spec typed by hand into the SQL editor still reads", () => {
  // `{"stems": 12}` is what a person writes when they are in the dashboard at
  // 11pm. Refusing it would mean the column is only usable by this app.
  const parsed = parseSpec({ stems: 12, name_on_ribbon: "Krizzia", gift_wrap: true });
  assert.deepEqual(parsed, [
    { key: "stems", label: "Stems", value: "12" },
    { key: "name_on_ribbon", label: "Name on ribbon", value: "Krizzia" },
    { key: "gift_wrap", label: "Gift wrap", value: "Yes" },
  ]);
});

test("a JSON string is parsed, because some clients hand jsonb back as text", () => {
  const raw = JSON.stringify({ answers: [{ key: "a", label: "A", value: "1" }] });
  assert.deepEqual(parseSpec(raw), [{ key: "a", label: "A", value: "1" }]);
});

test("blank answers are dropped and the first of a duplicated key wins", () => {
  const parsed = parseSpec([
    { key: "colour", label: "Colour", value: "Maroon" },
    { key: "colour", label: "Colour", value: "Gold" },
    { key: "note", label: "Note", value: "   " },
    { key: "", label: "Nameless", value: "x" },
  ]);
  assert.deepEqual(parsed, [{ key: "colour", label: "Colour", value: "Maroon" }]);
});

test("a number answer never comes back as a float", () => {
  // It gets printed on a ribbon. 11.999999999999998 is not a number of stems.
  assert.equal(parseSpec({ stems: 12 })[0]?.value, "12");
  assert.deepEqual(parseSpec({ stems: Number.NaN }), []);
});

/* ------------------------------------------------------------- writing -- */

test("an untouched line stores NULL, not an empty envelope", () => {
  // "Nothing was asked" and "asked and left blank" are different facts, and
  // only one of them is a mistake worth finding later.
  assert.equal(specJson([]), null);
  assert.equal(specJson([{ key: "a", label: "A", value: "  " }]), null);
  assert.deepEqual(specJson([{ key: "a", label: "A", value: "1" }]), {
    answers: [{ key: "a", label: "A", value: "1" }],
  });
});

test("answers carry the question's wording, not just its key", () => {
  // The reason: the question WILL be reworded — that is the point of making
  // them editable — and an order from March has to still say what was agreed
  // in March.
  const asked = [q({ key: "name", label: "Name on the ribbon", kind: "text" })];
  const answers = answersFrom(asked, { name: " Krizzia " });
  assert.deepEqual(answers, [
    { key: "name", label: "Name on the ribbon", value: "Krizzia" },
  ]);

  const reworded = [q({ key: "name", label: "Full name as it should print" })];
  // The stored answer is untouched by the rewording.
  assert.equal(parseSpec(specJson(answers))[0]?.label, "Name on the ribbon");
  assert.equal(reworded[0]?.label, "Full name as it should print");
});

test("answers come out in the order the questions are asked", () => {
  const asked = [
    q({ id: 1, key: "b", label: "B", sortOrder: 20 }),
    q({ id: 2, key: "a", label: "A", sortOrder: 10 }),
  ];
  const answers = answersFrom(questionsFor(asked), { a: "1", b: "2" });
  assert.deepEqual(answers.map((x) => x.key), ["a", "b"]);
});

test("a choice that is not on the list is not stored", () => {
  // Otherwise an option removed last month keeps arriving on new orders and
  // reads exactly like a current one.
  const asked = [q({ key: "colour", kind: "choice", options: ["Maroon", "Gold"] })];
  assert.deepEqual(answersFrom(asked, { colour: "Burgundy" }), []);
  assert.equal(answersFrom(asked, { colour: "Gold" })[0]?.value, "Gold");
});

test("required means required, and only when blank", () => {
  const asked = [
    q({ key: "name", label: "Name on the ribbon", required: true }),
    q({ id: 2, key: "note", label: "Anything else" }),
  ];
  assert.deepEqual(missingRequired(asked, {}).map((x) => x.key), ["name"]);
  assert.deepEqual(missingRequired(asked, { name: "  " }).map((x) => x.key), ["name"]);
  assert.deepEqual(missingRequired(asked, { name: "Krizzia" }), []);
});

/* -------------------------------------------------------------- scope -- */

test("a question with no category is asked about everything", () => {
  const asked = [
    q({ id: 1, key: "name", category: null }),
    q({ id: 2, key: "stems", category: "Graduation" }),
    q({ id: 3, key: "width", category: "Ribbon Prints" }),
  ];
  assert.deepEqual(questionsFor(asked, []).map((x) => x.key), ["name"]);
  assert.deepEqual(questionsFor(asked, ["Graduation"]).map((x) => x.key), ["name", "stems"]);
  assert.deepEqual(
    questionsFor(asked, ["Graduation", "Ribbon Prints"]).map((x) => x.key),
    ["name", "stems", "width"]
  );
});

test("a retired question is not asked, and its old answers are untouched", () => {
  const asked = [q({ key: "old", isActive: false })];
  assert.deepEqual(questionsFor(asked), []);
  // The answer already on an order still reads, because it was snapshotted.
  assert.equal(
    parseSpec({ answers: [{ key: "old", label: "How many stems", value: "9" }] })[0]?.value,
    "9"
  );
});

test("questions sort by the owner's order, then by age", () => {
  const asked = [
    q({ id: 3, key: "c", sortOrder: 0 }),
    q({ id: 1, key: "a", sortOrder: 0 }),
    q({ id: 2, key: "b", sortOrder: -10 }),
  ];
  assert.deepEqual(questionsFor(asked).map((x) => x.key), ["b", "a", "c"]);
});

test("the categories in use are listed once each, sorted", () => {
  const asked = [
    q({ id: 1, category: "Graduation" }),
    q({ id: 2, category: "Graduation" }),
    q({ id: 3, category: "Add-ons" }),
    q({ id: 4, category: null }),
  ];
  assert.deepEqual(scopedCategories(asked), ["Add-ons", "Graduation"]);
});

/* ------------------------------------------------------------ showing -- */

test("a summary says what each answer is an answer to", () => {
  const answers = parseSpec({
    answers: [
      { key: "stems", label: "Stems", value: "12" },
      { key: "colour", label: "Colour", value: "Maroon + gold" },
      { key: "name", label: "Name", value: "Krizzia" },
      { key: "card", label: "Card", value: "Congrats!" },
    ],
  });
  // "12 · Maroon + gold · Krizzia" out of context is three facts about
  // nothing.
  assert.equal(
    specSummary(answers),
    "Stems: 12 · Colour: Maroon + gold · Name: Krizzia · +1 more"
  );
  assert.equal(specSummary([]), "");
  assert.equal(hasSpec(answers), true);
  assert.equal(hasSpec([]), false);
});

test("a printed ticket gets every answer, never an abbreviated one", () => {
  // The ticket goes to the bench. A spec trimmed to fit is how the wrong
  // thing gets made.
  const answers = Array.from({ length: 6 }, (_, i) => ({
    key: `k${i}`,
    label: `Q${i}`,
    value: String(i),
  }));
  assert.equal(specLines(answers).length, 6);
});

/* ------------------------------------------------------------- naming -- */

test("a typed label becomes a key a JSON reader can hold", () => {
  assert.equal(slugify("Name on the ribbon"), "name_on_the_ribbon");
  assert.equal(slugify("  Colour / shade!  "), "colour_shade");
  assert.equal(slugify("Piña colour"), "pina_colour");
  // The column's own CHECK insists on starting with a letter.
  assert.equal(slugify("2nd colour"), "q2nd_colour");
  assert.equal(slugify("???"), "");
  assert.ok(slugify("a".repeat(80)).length <= 40);
});

test("a key with no label is still readable", () => {
  assert.equal(humanise("name_on_ribbon"), "Name on ribbon");
  assert.equal(humanise(""), "");
});
