import { cancellationKeys } from "@/lib/order-statuses";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  costBatches,
  costMeals,
  makeableServings,
  type ProductionRun,
  type BatchCost,
  type BatchIngredient,
  type Material,
  type Product,
  type MealComponent,
  type MealCost,
  type MealIngredient,
} from "@/lib/costing";
import { isPacked } from "@/lib/orders";

/**
 * The recipe book, loaded once.
 *
 * Three screens and one server action need the same six tables costed the same
 * way. Three copies of that query is three places to forget a table the day a
 * seventh one matters — and the failure would be silent, because a missing
 * recipe table reads exactly like "no recipes entered".
 */
export type CostBook = {
  materials: Material[];
  production_runs: ProductionRun[];
  /** Per-product take-out packaging, priced per serving. */
  packagingCost: Map<string, number>;
  /** The same lines, so the editor can show and change them. */
  productPackaging: MealIngredient[];
  /** Charged once per take-out order, not per product. */
  orderPackaging: { ref_type: string; ref_id: string; qty: number }[];
  orderPackagingCost: number;
  /** The raw recipe rows, for the screens that edit them rather than cost them. */
  productionRunMaterials: BatchIngredient[];
  productMaterials: MealIngredient[];
  batchCosts: Map<string, BatchCost>;
  mealCosts: Map<string, MealCost>;
  /** Human-readable names of any table that wouldn't load. */
  failed: string[];
};

export async function loadCostBook(): Promise<CostBook> {
  const supabase = createAdminClient();
  const [ing, bat, batIng, mea, meaIng, meaComp, mealPack, orderPack] =
    await Promise.all([
      supabase.from("materials").select("*"),
      supabase.from("production_runs").select("*"),
      supabase.from("production_run_materials").select("*"),
      supabase.from("products").select("*").order("name"),
      supabase.from("product_materials").select("*"),
      supabase.from("product_components").select("*"),
      supabase.from("product_packaging").select("*"),
      supabase.from("order_packaging").select("*"),
    ]);

  // supabase-js returns errors rather than throwing, so a failed read arrives
  // as an empty array and would otherwise cost every product at ₱0 — which looks
  // like wonderful margins rather than a broken query.
  const failed = [
    ing.error && "materials",
    bat.error && "production_runs",
    batIng.error && "batch recipes",
    mea.error && "products",
    meaIng.error && "product recipes",
    meaComp.error && "combos",
  ].filter(Boolean) as string[];
  for (const [label, err] of [
    ["materials", ing.error],
    ["production_runs", bat.error],
    ["production_run_materials", batIng.error],
    ["products", mea.error],
    ["product_materials", meaIng.error],
    ["product_components", meaComp.error],
  ] as const) {
    if (err) console.error(`[costing] ${label}: ${err.message}`);
  }

  const materials = (ing.data ?? []) as Material[];
  const production_runs = (bat.data ?? []) as ProductionRun[];
  const batchCosts = costBatches(
    production_runs,
    (batIng.data ?? []) as BatchIngredient[],
    materials
  );
  const mealCosts = costMeals(
    (mea.data ?? []) as Product[],
    (meaIng.data ?? []) as MealIngredient[],
    (meaComp.data ?? []) as MealComponent[],
    materials,
    batchCosts
  );

  // Packaging is priced with the same unit costs as the food, but kept apart:
  // a product eaten at the stall uses none of it, and rolling it into the recipe
  // is exactly what forced 27 duplicate products onto this menu.
  const priceOf = (refType: string, refId: string, qty: number) => {
    if (refType === "production_run") return (batchCosts.get(refId)?.perUnit ?? 0) * qty;
    const found = materials.find((i) => i.id === refId);
    return (Number(found?.cost) || 0) * qty;
  };

  const productPackaging = (mealPack.data ?? []) as MealIngredient[];
  const packagingCost = new Map<string, number>();
  for (const line of productPackaging) {
    packagingCost.set(
      line.product_id,
      (packagingCost.get(line.product_id) ?? 0) +
        priceOf(line.ref_type, line.ref_id, Number(line.qty) || 0)
    );
  }

  const orderPackaging = (orderPack.data ?? []) as {
    ref_type: string;
    ref_id: string;
    qty: number;
  }[];
  const orderPackagingCost = orderPackaging.reduce(
    (sum, l) => sum + priceOf(l.ref_type, l.ref_id, Number(l.qty) || 0),
    0
  );

  return {
    materials,
    production_runs,
    packagingCost,
    productPackaging,
    orderPackaging,
    orderPackagingCost,
    productionRunMaterials: (batIng.data ?? []) as BatchIngredient[],
    productMaterials: (meaIng.data ?? []) as MealIngredient[],
    batchCosts,
    mealCosts,
    failed,
  };
}

/**
 * What an order cost to make, priced at the moment it was sold.
 *
 * Snapshotted onto the order rather than worked out again later, because
 * material prices move: a bowl sold in August cost what pork cost in August,
 * and re-deriving it next year from next year's prices would quietly rewrite
 * history. `orders.cogs` and `orders.gross_profit` have been columns since the
 * first migration and have been zero on every row ever written.
 */
export async function recordOrderCost(orderId: string): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: order, error: orderError }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("revenue, fulfillment")
        .eq("id", orderId)
        .maybeSingle(),
      supabase.from("order_lines").select("product_id, qty").eq("order_id", orderId),
    ]);

  if (orderError || linesError || !order) {
    // Never fatal. A sale that was recorded but not costed is a small gap in
    // the reporting; a sale that failed to record because the costing failed
    // is money missing from the day's takings.
    console.error(
      `[costing] couldn't cost order ${orderId}: ${
        orderError?.message ?? linesError?.message ?? "order not found"
      }`
    );
    return;
  }

  const { mealCosts, packagingCost, orderPackagingCost } = await loadCostBook();

  // Anything not eaten at the stall leaves in a box, and the box is a real
  // cost. Charged here on the same rule the stock engine uses, so the estimate
  // and the movement that later overwrites it are answering the same question.
  const packed = isPacked((order as { fulfillment?: string }).fulfillment ?? "pickup");

  let cogs = 0;
  let anyLine = false;
  for (const line of (lines ?? []) as { product_id: string; qty: number }[]) {
    anyLine = true;
    const qty = Number(line.qty) || 0;
    if (packed) cogs += (packagingCost.get(line.product_id) ?? 0) * qty;
    const mc = mealCosts.get(line.product_id);
    // A product with no recipe adds nothing rather than guessing. It makes the
    // cost a floor and the profit a ceiling, which is why the screens that
    // show profit also say how many products still have no recipe.
    if (!mc?.costed) continue;
    cogs += mc.cost * qty;
  }
  // The bag: once for the order, however many products are in it.
  if (packed && anyLine) cogs += orderPackagingCost;

  const revenue = Number(order.revenue) || 0;
  const { error } = await supabase
    .from("orders")
    .update({
      cogs: Math.round(cogs * 100) / 100,
      gross_profit: Math.round((revenue - cogs) * 100) / 100,
    })
    .eq("id", orderId);
  if (error) console.error(`[costing] update ${orderId}: ${error.message}`);
}

/**
 * How much of each product has actually sold.
 *
 * Menu engineering without sales volume is just a cost list — half the
 * quadrants are about popularity. Kept here rather than in the page because
 * the page is a component, and reading the clock during render is exactly
 * the impurity the React compiler warns about.
 */
export async function loadSalesVolume(
  days = 90
): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_lines")
    .select("product_id, qty, orders!inner(date, status)")
    .gte("orders.date", since)
    // Cancelled work never happened, so it never cost anything. Which step
    // means cancelled is the shop's to name.
    .not("orders.status", "in", `(${cancellationKeys(await getOrderStatuses()).join(",")})`);
  if (error) {
    console.error(`[costing] sales volume: ${error.message}`);
    return new Map();
  }
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { product_id: string; qty: number }[]) {
    out.set(r.product_id, (out.get(r.product_id) ?? 0) + (Number(r.qty) || 0));
  }
  return out;
}

/**
 * How many of each product the shelf can still produce.
 *
 * Four light queries rather than the full cost book: the customer menu is the
 * busiest page on the site and has no use for prices, recipes or margins —
 * only for whether a thing can still be made.
 *
 * Returns a map of product id to servings. Absent means unconstrained (no recipe
 * entered), which is not the same as zero.
 */
export async function loadAvailability(): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const [ing, bat, meaIng, meaComp] = await Promise.all([
    supabase.from("materials").select("id, stock"),
    supabase.from("production_runs").select("id, run_stock"),
    supabase.from("product_materials").select("product_id, ref_type, ref_id, qty"),
    supabase.from("product_components").select("product_id, component_meal_id, qty"),
  ]);

  // A failed read must not close the shop. Returning an empty map leaves
  // every product unconstrained, which is how the menu behaved before any of
  // this existed — the safe direction to fail in.
  if (ing.error || bat.error || meaIng.error || meaComp.error) {
    console.error(
      `[availability] ${
        ing.error?.message ??
        bat.error?.message ??
        meaIng.error?.message ??
        meaComp.error?.message
      }`
    );
    return new Map();
  }

  const materials = (ing.data ?? []).map((r) => ({
    ...(r as { id: string; stock: number }),
  })) as Material[];
  const production_runs = (bat.data ?? []).map((r) => ({
    ...(r as { id: string; run_stock: number }),
  })) as ProductionRun[];
  const productMaterials = (meaIng.data ?? []) as MealIngredient[];
  const productComponents = (meaComp.data ?? []) as MealComponent[];

  const mealIds = new Set<string>([
    ...productMaterials.map((m) => m.product_id),
    ...productComponents.map((m) => m.product_id),
  ]);

  const out = new Map<string, number>();
  for (const id of mealIds) {
    const n = makeableServings(
      id,
      productMaterials,
      productComponents,
      materials,
      production_runs
    );
    if (Number.isFinite(n)) out.set(id, n);
  }
  return out;
}
