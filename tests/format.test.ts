import test from "node:test";
import assert from "node:assert/strict";
import { money, moneyRound, quantity, duration, shopToday, formatDate } from "../src/lib/format.ts";
import { brand } from "../config/index.ts";

test("money puts the sign outside the symbol", () => {
  assert.equal(money(1234.5), `${brand.currency.symbol}1,234.50`);
  assert.equal(money(-1.25), `-${brand.currency.symbol}1.25`);
  assert.equal(money(0), `${brand.currency.symbol}0.00`);
});

test("money survives the values a database actually returns", () => {
  assert.equal(money(NaN), `${brand.currency.symbol}0.00`);
  assert.equal(money(undefined as unknown as number), `${brand.currency.symbol}0.00`);
  assert.equal(money(null as unknown as number), `${brand.currency.symbol}0.00`);
});

test("moneyRound drops the centavos without dropping the grouping", () => {
  assert.equal(moneyRound(1288190.4), `${brand.currency.symbol}1,288,190`);
  assert.equal(moneyRound(-40.6), `-${brand.currency.symbol}41`);
});

test("quantity groups and respects decimals", () => {
  assert.equal(quantity(19.2, 1), "19.2");
  assert.equal(quantity(1240), "1,240");
});

test("duration reads the way a person says it", () => {
  assert.equal(duration(45), "45 min");
  assert.equal(duration(60), "1 hr");
  assert.equal(duration(185), "3 hr 5 min");
  assert.equal(duration(-5), "0 min");
});

test("shopToday is the shop's calendar date, not the server's", () => {
  // 23:30 UTC is already tomorrow in Manila. Reading the UTC date here is the
  // bug that makes a "today" filter return nothing until 8am, every day.
  const lateUtc = new Date("2026-09-13T23:30:00Z");
  const here = shopToday(lateUtc);
  assert.match(here, /^\d{4}-\d{2}-\d{2}$/);

  const offsetHours =
    (new Date(lateUtc.toLocaleString("en-US", { timeZone: brand.timeZone })).getTime() -
      new Date(lateUtc.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 3_600_000;
  const expected = offsetHours > 0.5 ? "2026-09-14" : "2026-09-13";
  assert.equal(here, expected, `for ${brand.timeZone}`);
});

test("dates format in the shop's zone and locale", () => {
  const s = formatDate("2026-09-13T23:30:00Z");
  assert.ok(s.length > 0);
  assert.doesNotMatch(s, /Invalid/);
});
