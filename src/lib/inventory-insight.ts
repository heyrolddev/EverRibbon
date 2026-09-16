import { shopToday } from "./format.ts";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductionRun, BatchIngredient, Material } from "@/lib/costing";

/**
 * The two things the store room can work out that a person can't at a glance.
 *
 * A reorder level is a number somebody guessed once. Now that every sale
 * writes to `material_usage`, the shop can be told what it actually gets
 * through — and a static "reorder at 100g" can be compared against "you use
 * 43g a day, so 100g is two days".
 */

export type Suggestion = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  /** Average used per day over the lookback window. */
  dailyAvg: number;
  /** How many days the current stock lasts at that rate. */
  daysLeft: number;
  /** What to have on the shelf to cover `coverDays`. */
  parLevel: number;
  /** parLevel − stock, floored at zero. */
  buy: number;
  cost: number;
  /**
   * Batches already made from this material that are still in stock.
   * "Low, but you've got 2,125g of Black Pepper Sauce made" stops a panic
   * buy for something already prepped — the single most useful line in the
   * old app.
   */
  coveredBy: { name: string; qty: number; unit: string }[];
};

export type ExpiringLot = {
  materialId: string;
  name: string;
  unit: string;
  qty: number;
  cost: number;
  expiryDate: string;
  /** Negative when it has already gone. */
  daysLeft: number;
};

export type Insight = {
  suggestions: Suggestion[];
  expiring: ExpiringLot[];
  /** How many days of history the averages are built on. */
  lookbackDays: number;
  coverDays: number;
  /** True when there isn't enough history for the averages to mean anything. */
  thin: boolean;
};

const LOOKBACK_DAYS = 30;
const COVER_DAYS = 7;
const EXPIRY_WARNING_DAYS = 5;

/** Midnight-to-midnight day difference, so "today" is 0 and not 0.4. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00Z").getTime() -
      new Date(from + "T00:00:00Z").getTime()) /
      86_400_000
  );
}

export async function loadInsight(
  materials: Material[],
  production_runs: ProductionRun[],
  productionRunMaterials: BatchIngredient[]
): Promise<Insight> {
  const supabase = createAdminClient();
  const today = shopToday();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [{ data: usage, error: usageError }, { data: lots, error: lotsError }] =
    await Promise.all([
      supabase
        .from("material_usage")
        .select("material_id, qty, type, date")
        .gte("date", since)
        // What the shop sells and prepares, not what it throws away. Buying
        // more to cover what keeps getting binned is how a waste problem
        // becomes permanent — waste has its own log and its own screen.
        .in("type", ["sale", "production_run"]),
      supabase
        .from("material_lots")
        .select("material_id, qty, cost, expiry_date")
        .not("expiry_date", "is", null)
        .gt("qty", 0),
    ]);

  if (usageError) console.error(`[insight] usage: ${usageError.message}`);
  if (lotsError) console.error(`[insight] lots: ${lotsError.message}`);

  const used = new Map<string, number>();
  let earliest = today;
  for (const row of (usage ?? []) as {
    material_id: string;
    qty: number;
    date: string;
  }[]) {
    used.set(row.material_id, (used.get(row.material_id) ?? 0) + Number(row.qty || 0));
    if (row.date < earliest) earliest = row.date;
  }

  // Averaged over the days there is actually history for, not a flat 30. In
  // the first week of trading, dividing a week of sales by thirty would say
  // the shop uses a quarter of what it does and order accordingly.
  const observedDays = Math.max(1, daysBetween(earliest, today) + 1);
  const thin = observedDays < 7;

  const batchById = new Map(production_runs.map((b) => [b.id, b]));
  const usesIngredient = new Map<string, ProductionRun[]>();
  for (const bi of productionRunMaterials) {
    const b = batchById.get(bi.production_run_id);
    if (!b) continue;
    const list = usesIngredient.get(bi.material_id) ?? [];
    list.push(b);
    usesIngredient.set(bi.material_id, list);
  }

  const suggestions: Suggestion[] = [];
  for (const ing of materials) {
    const total = used.get(ing.id) ?? 0;
    const dailyAvg = total / observedDays;
    if (dailyAvg <= 0) continue; // nothing used, so nothing to say

    const stock = Number(ing.stock) || 0;
    const parLevel = dailyAvg * COVER_DAYS;
    if (stock >= parLevel) continue;

    suggestions.push({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      stock,
      dailyAvg,
      daysLeft: dailyAvg > 0 ? stock / dailyAvg : Infinity,
      parLevel,
      buy: Math.max(0, parLevel - stock),
      cost: Math.max(0, parLevel - stock) * (Number(ing.cost) || 0),
      coveredBy: (usesIngredient.get(ing.id) ?? [])
        .filter((b) => Number(b.run_stock) > Number(b.reorder_level || 0))
        .map((b) => ({
          name: b.name,
          qty: Number(b.run_stock) || 0,
          unit: b.yield_unit,
        })),
    });
  }
  // Soonest to run out first — the order you would actually shop in.
  suggestions.sort((a, b) => a.daysLeft - b.daysLeft);

  const ingById = new Map(materials.map((i) => [i.id, i]));
  const expiring: ExpiringLot[] = [];
  for (const lot of (lots ?? []) as {
    material_id: string;
    qty: number;
    cost: number;
    expiry_date: string;
  }[]) {
    const daysLeft = daysBetween(today, lot.expiry_date);
    if (daysLeft > EXPIRY_WARNING_DAYS) continue;
    const ing = ingById.get(lot.material_id);
    expiring.push({
      materialId: lot.material_id,
      name: ing?.name ?? "Deleted material",
      unit: ing?.unit ?? "",
      qty: Number(lot.qty) || 0,
      cost: (Number(lot.qty) || 0) * (Number(lot.cost) || 0),
      expiryDate: lot.expiry_date,
      daysLeft,
    });
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    suggestions,
    expiring,
    lookbackDays: observedDays,
    coverDays: COVER_DAYS,
    thin,
  };
}

/**
 * Is this getting dearer?
 *
 * `purchases` has had rows written to it since restock landed, and two
 * deliveries of the same thing at different prices is the earliest warning a
 * shop gets that its margins are about to move. Compared against the previous
 * delivery rather than an average: an average smooths away exactly the jump
 * that matters.
 */
export type PriceMove = {
  materialId: string;
  /** ₱ per unit last time it was bought. */
  previous: number;
  latest: number;
  /** Positive when it went up. */
  pct: number;
  on: string;
};

export async function loadPriceMoves(): Promise<Map<string, PriceMove>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("material_id, date, qty, cost")
    .order("date", { ascending: false })
    .limit(500);
  if (error) {
    console.error(`[insight] purchases: ${error.message}`);
    return new Map();
  }

  const byIngredient = new Map<string, { date: string; unit: number }[]>();
  for (const row of (data ?? []) as {
    material_id: string;
    date: string;
    qty: number;
    cost: number;
  }[]) {
    const qty = Number(row.qty) || 0;
    if (qty <= 0) continue;
    const list = byIngredient.get(row.material_id) ?? [];
    list.push({ date: row.date, unit: (Number(row.cost) || 0) / qty });
    byIngredient.set(row.material_id, list);
  }

  const out = new Map<string, PriceMove>();
  for (const [id, list] of byIngredient) {
    if (list.length < 2) continue; // one delivery is a price, not a trend
    const [latest, previous] = list; // already newest-first
    // list.length >= 2 above guarantees both, but only to a reader.
    if (!latest || !previous || previous.unit <= 0) continue;
    const pct = ((latest.unit - previous.unit) / previous.unit) * 100;
    // Under two percent is noise — a supplier rounding, not a price move.
    if (Math.abs(pct) < 2) continue;
    out.set(id, {
      materialId: id,
      previous: previous.unit,
      latest: latest.unit,
      pct,
      on: latest.date,
    });
  }
  return out;
}

/**
 * Recipes pointing at things that no longer exist.
 *
 * Deleting a material in use is refused, so this should stay empty — but
 * "should" is doing a lot of work in a database that can also be edited
 * directly, restored from a backup, or seeded by a script. A product quietly
 * costing less than it does reads as a product that got more profitable, which
 * is the failure this whole system keeps having to design against.
 */
export type HealthIssue = { kind: string; detail: string };

export async function runHealthCheck(): Promise<HealthIssue[]> {
  const supabase = createAdminClient();
  const [ing, bat, mea, batIng, meaIng, meaComp] = await Promise.all([
    supabase.from("materials").select("id"),
    supabase.from("production_runs").select("id, name"),
    supabase.from("products").select("id, name"),
    supabase.from("production_run_materials").select("production_run_id, material_id"),
    supabase.from("product_materials").select("product_id, ref_type, ref_id"),
    supabase.from("product_components").select("product_id, component_meal_id"),
  ]);

  const ingIds = new Set(((ing.data ?? []) as { id: string }[]).map((r) => r.id));
  const batchName = new Map(
    ((bat.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])
  );
  const mealName = new Map(
    ((mea.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])
  );

  const issues: HealthIssue[] = [];

  for (const r of (batIng.data ?? []) as { production_run_id: string; material_id: string }[]) {
    if (!ingIds.has(r.material_id)) {
      issues.push({
        kind: "Batch recipe",
        detail: `"${batchName.get(r.production_run_id) ?? r.production_run_id}" uses a material that no longer exists.`,
      });
    }
  }
  for (const r of (meaIng.data ?? []) as {
    product_id: string;
    ref_type: string;
    ref_id: string;
  }[]) {
    const missing =
      r.ref_type === "inv" ? !ingIds.has(r.ref_id) : !batchName.has(r.ref_id);
    if (missing) {
      issues.push({
        kind: "Product recipe",
        detail: `"${mealName.get(r.product_id) ?? r.product_id}" uses a ${r.ref_type === "inv" ? "material" : "production_run"} that no longer exists.`,
      });
    }
  }
  for (const r of (meaComp.data ?? []) as {
    product_id: string;
    component_meal_id: string;
  }[]) {
    if (!mealName.has(r.component_meal_id)) {
      issues.push({
        kind: "Combo",
        detail: `"${mealName.get(r.product_id) ?? r.product_id}" contains a product that no longer exists.`,
      });
    }
  }

  // Two products with the same name is not corruption, but it is the reason a
  // best-seller list can't be read — the real menu has exactly this.
  const seen = new Map<string, number>();
  for (const name of mealName.values()) {
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  for (const [name, n] of seen) {
    if (n > 1) {
      issues.push({
        kind: "Duplicate name",
        detail: `${n} products are both called "${name}" — you can't tell which one sold.`,
      });
    }
  }

  return issues;
}
