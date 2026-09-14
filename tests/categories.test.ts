import test from "node:test";
import assert from "node:assert/strict";
import {
  categoriesUsed,
  cleanCategories,
  countByCategory,
  inCategory,
  menuRank,
  orderForMenu,
} from "../src/lib/categories.ts";

/**
 * What a product is actually saved with.
 *
 * The whole point of the categories table is that "Chicken", "chicken" and
 * "Chicken " do not become three filter pills on a customer's screen. Now
 * that a product can carry several, the same mess can happen inside one product —
 * two chips that look identical and behave as separate things.
 */

test("blanks and whitespace are dropped", () => {
  assert.deepEqual(cleanCategories(["Chicken", "", "   ", "Rice"]), ["Chicken", "Rice"]);
  assert.deepEqual(cleanCategories([]), []);
  assert.deepEqual(cleanCategories(undefined), []);
});

test("names are trimmed", () => {
  assert.deepEqual(cleanCategories(["  Chicken  ", "Rice "]), ["Chicken", "Rice"]);
});

test("the same name in a different case is one category, not two", () => {
  assert.deepEqual(cleanCategories(["Chicken", "chicken", "CHICKEN"]), ["Chicken"]);
});

test("the first spelling is the one kept", () => {
  // Not the last, and not lowercased: whatever the owner typed first is what
  // they meant the menu to read.
  assert.deepEqual(cleanCategories(["chicken", "Chicken"]), ["chicken"]);
  assert.deepEqual(cleanCategories(["Rice Products", "rice products"]), ["Rice Products"]);
});

test("order survives, because the first one leads", () => {
  // A product shows one category anywhere there is no room for three, and that
  // one is the first — so reordering silently would change what the product
  // reads as on the menu.
  assert.deepEqual(
    cleanCategories(["Bestseller", "Chicken", "Rice"]),
    ["Bestseller", "Chicken", "Rice"]
  );
});

test("a product can carry several, which is the point", () => {
  const many = ["Chicken", "Rice Products", "Bestseller", "Spicy"];
  assert.deepEqual(cleanCategories(many), many);
});

test("trailing space does not create a second category", () => {
  // The exact bug the categories table was built to stop, now possible
  // inside a single product.
  assert.deepEqual(cleanCategories(["Chicken", "Chicken "]), ["Chicken"]);
});

/* ------------------------------------------------------------------ *
 * Grouping products by category
 *
 * Three screens ask these questions — the customer's menu, the till, and the
 * chip counts in HQ — and each of them once answered with `categoryOf`, which
 * returns only a product's FIRST category. That produced a chip reading
 * "Ji Wings 0" beside a Ji Wings product, and a till where that product could not
 * be found under Ji Wings mid-order.
 *
 * These test the shared functions rather than a copy, which is the point:
 * the bug survived two screens because the fix was written inline in the
 * third.
 * ------------------------------------------------------------------ */

/** The product that started it: a Ji Wings product whose first category is Mains. */
const jiWings = { categories: ["Mains", "Ji Wings"] };

test("a product is in every category it carries, not just the first", () => {
  assert.equal(inCategory(jiWings, "Mains"), true);
  assert.equal(inCategory(jiWings, "Ji Wings"), true, "the reported bug");
  assert.equal(inCategory(jiWings, "Drinks"), false);
});

test("a category holding a product never counts zero", () => {
  const counts = countByCategory([jiWings]);
  assert.equal(counts["Ji Wings"], 1, "counted 0 before this");
  assert.equal(counts["Mains"], 1);
});

test("counts deliberately sum to more than the number of products", () => {
  // A product in two categories is in both. The chip asks "how many products are
  // in here", and that is the honest answer to it.
  const counts = countByCategory([jiWings, { categories: ["Drinks"] }]);
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  assert.equal(total, 3, "two products, three memberships");
});

test("an untagged product counts nowhere and matches nothing but All", () => {
  assert.deepEqual(countByCategory([{ categories: [] }]), {});
  assert.equal(inCategory({ categories: null }, "Mains"), false);
});

test("pills come from the products, not from the categories table", () => {
  // A menu imported from elsewhere has categories on its products and no rows
  // in `catalog_categories`; the filter bar used to hide itself entirely.
  assert.deepEqual(
    categoriesUsed([{ categories: ["Mains"] }, { categories: ["Drinks"] }]),
    ["Drinks", "Mains"]
  );
});

test("the shop's own order wins, and the rest follow alphabetically", () => {
  const products = [
    { categories: ["Sides"] },
    { categories: ["Drinks"] },
    { categories: ["Mains"] },
  ];
  const known = [{ name: "Mains" }, { name: "Drinks" }];
  assert.deepEqual(categoriesUsed(products, known), ["Mains", "Drinks", "Sides"]);
});

test("a category with a row but no product does not become a pill", () => {
  // An empty pill is a promise the menu cannot keep.
  assert.deepEqual(
    categoriesUsed([{ categories: ["Mains"] }], [{ name: "Mains" }, { name: "Desserts" }]),
    ["Mains"]
  );
});

test("blank and whitespace categories are ignored everywhere", () => {
  assert.deepEqual(categoriesUsed([{ categories: ["  ", "", " Mains "] }]), ["Mains"]);
  assert.deepEqual(countByCategory([{ categories: ["  ", "Mains"] }]), { Mains: 1 });
  assert.equal(inCategory({ categories: [" Mains "] }, "Mains"), true);
});

/* ============================================================
 * The order the menu opens in
 *
 * The bug these guard against had a screenshot: the customer menu, "All"
 * selected, and the first four cards were 1.5 Coke, 1.5 Sprite, a milktea
 * and an iced americano. A shop that sells Taiwan-style black pepper noodles
 * opened on two litres of soft drink.
 *
 * Nobody chose that. It was `order by name` from the database showing
 * through, and names beginning with digits sort before names beginning with
 * letters. The fix is that the grid reads the same ordered category list the
 * filter pills are drawn from.
 * ============================================================ */

/** The shop's order, food first — what migration 0040 sets. */
const SHOP_ORDER = [
  "Mains",
  "Ji Pai",
  "Solo",
  "Burger",
  "Premium Sides",
  "Coffee",
  "Milktea",
  "Raspberry",
  "Soft drinks",
  "Drinks",
];

const product = (name: string, ...categories: string[]) => ({ name, categories });

/** The menu from the screenshot, near enough. */
const MENU = [
  product("1.5 Coke", "Drinks", "Soft drinks"),
  product("1.5 Sprite", "Drinks", "Soft drinks"),
  product("16oz Brown Sugar Milktea", "Drinks", "Milktea"),
  product("16oz Iced Americano", "Drinks", "Coffee"),
  product("Black Pepper Noodles", "Mains"),
  product("Ji Pai Chicken", "Ji Pai"),
  product("Solo Rice Product", "Solo"),
  product("Pepper Burger", "Burger"),
];

const namesOf = (rows: { name: string }[]) => rows.map((r) => r.name);

test("the screenshot: sorting by name alone puts the soft drinks first", () => {
  // Not a test of our code — a test of the thing we replaced, so the reason
  // this file exists stays legible.
  const byName = [...MENU].sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(namesOf(byName).slice(0, 3), [
    "1.5 Coke",
    "1.5 Sprite",
    "16oz Brown Sugar Milktea",
  ]);
});

test("the food leads and the soft drinks come last", () => {
  const ordered = namesOf(orderForMenu(MENU, SHOP_ORDER));
  assert.deepEqual(ordered, [
    "Black Pepper Noodles",
    "Ji Pai Chicken",
    "Solo Rice Product",
    "Pepper Burger",
    "16oz Iced Americano",
    "16oz Brown Sugar Milktea",
    "1.5 Coke",
    "1.5 Sprite",
  ]);
});

test("a drink files under what it actually is, not under the umbrella", () => {
  // The reason "Drinks" is placed last. Nearly every drink carries it as a
  // second tag, so a "Drinks" ranked early would collapse coffee, milktea and
  // soft drinks into one block and lose the order the shop asked for.
  const order = new Map(SHOP_ORDER.map((n, i) => [n, i]));
  assert.equal(
    menuRank(product("16oz Brown Sugar Milktea", "Drinks", "Milktea"), order),
    SHOP_ORDER.indexOf("Milktea")
  );
  assert.equal(
    menuRank(product("1.5 Coke", "Drinks", "Soft drinks"), order),
    SHOP_ORDER.indexOf("Soft drinks")
  );
});

test("a drink tagged only Drinks still lands at the end", () => {
  const withPlain = [...MENU, product("Bottled Water", "Drinks")];
  assert.equal(namesOf(orderForMenu(withPlain, SHOP_ORDER)).at(-1), "Bottled Water");
});

test("tag order on the product makes no difference", () => {
  // The owner cannot see which of a product's categories is first, so it must
  // not be what decides where the product appears.
  const a = orderForMenu([product("X", "Drinks", "Milktea")], SHOP_ORDER);
  const b = orderForMenu([product("X", "Milktea", "Drinks")], SHOP_ORDER);
  const order = new Map(SHOP_ORDER.map((n, i) => [n, i]));
  assert.equal(menuRank(a[0]!, order), menuRank(b[0]!, order));
});

test("a product in no known category sorts last, not first", () => {
  const rows = [product("Mystery Item", "Nobody Set This Up"), product("Ji Pai Chicken", "Ji Pai")];
  assert.deepEqual(namesOf(orderForMenu(rows, SHOP_ORDER)), [
    "Ji Pai Chicken",
    "Mystery Item",
  ]);
});

test("a product with no categories at all sorts last too", () => {
  const rows = [{ name: "Untagged", categories: null }, product("Ji Pai Chicken", "Ji Pai")];
  assert.deepEqual(namesOf(orderForMenu(rows, SHOP_ORDER)), [
    "Ji Pai Chicken",
    "Untagged",
  ]);
});

test("within one category, drink sizes read in the order a person says them", () => {
  const cups = [
    product("22oz Milktea", "Milktea"),
    product("8oz Milktea", "Milktea"),
    product("16oz Milktea", "Milktea"),
  ];
  assert.deepEqual(namesOf(orderForMenu(cups, SHOP_ORDER)), [
    "8oz Milktea",
    "16oz Milktea",
    "22oz Milktea",
  ]);
});

test("no known categories at all is name order, not a crash", () => {
  assert.deepEqual(namesOf(orderForMenu(MENU, [])).slice(0, 2), ["1.5 Coke", "1.5 Sprite"]);
});

test("the caller's array is left alone", () => {
  const before = namesOf(MENU);
  orderForMenu(MENU, SHOP_ORDER);
  assert.deepEqual(namesOf(MENU), before);
});

test("the pills and the grid read the same list", () => {
  // `categoriesUsed` draws the filter row; `orderForMenu` takes its output.
  // If these two ever computed their order separately they would drift, and
  // the pills would claim an order the products below them did not follow.
  const known = SHOP_ORDER.map((name) => ({ name }));
  const pills = categoriesUsed(MENU, known);
  assert.deepEqual(pills.slice(0, 4), ["Mains", "Ji Pai", "Solo", "Burger"]);
  assert.equal(namesOf(orderForMenu(MENU, pills))[0], "Black Pepper Noodles");
});
