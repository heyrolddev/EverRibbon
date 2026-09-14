import { can, getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MenuCategory } from "@/lib/categories";
import { loadCostBook, loadSalesVolume } from "@/lib/costing-server";
import { classifyMenu, marginFor, menuClassFor } from "@/lib/costing";
import { DishCosts, type DishRow } from "@/components/product-costs";
import type { RecipeOption } from "@/components/recipe-editor";
import { hqTitle } from "@/lib/hq-theme";

// Recipes and prices change from the Menu screen; a cached cost is a wrong one.
export const dynamic = "force-dynamic";

export default async function AdminCostingPage() {
  const viewer = await getViewer();

  // What every product earns is the owner's business, not a shift's. Hidden from
  // the sidebar for staff too, but checked here because hiding a link is not
  // a permission.
  if (!can(viewer, "costs")) {
    return (
      <div className="rounded-3xl bg-paper-100 p-8 ring-1 ring-ink-950/10">
        <h2 className={hqTitle}>Owner only</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-900/70">
          Costs and margins are the owner&apos;s to see. Staff can check what
          stock is left on the Inventory screen.
        </p>
      </div>
    );
  }

  const {
    mealCosts,
    batchCosts,
    materials,
    productMaterials,
    packagingCost,
    productPackaging,
    orderPackaging,
    orderPackagingCost,
    failed,
  } = await loadCostBook();

  const packagingByMeal = new Map<string, typeof productPackaging>();
  for (const mp of productPackaging) {
    const list = packagingByMeal.get(mp.product_id) ?? [];
    list.push(mp);
    packagingByMeal.set(mp.product_id, list);
  }

  // Menu engineering needs popularity as well as margin.
  const soldByMeal = await loadSalesVolume();

  const supabase = createAdminClient();
  const { data: catRows } = await supabase
    .from("catalog_categories")
    .select("name, colour, sort_order")
    .order("sort_order")
    .order("name");

  // What a recipe line may point at: every material, and every production_run at its
  // cost per unit of yield — the same number the costing engine multiplies by.
  const options: RecipeOption[] = [
    ...materials.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      unitCost: Number(i.cost) || 0,
      kind: "inv" as const,
      stock: Number(i.stock) || 0,
    })),
    ...[...batchCosts.values()].map((b) => ({
      id: b.production_run.id,
      name: b.production_run.name,
      unit: b.production_run.yield_unit,
      unitCost: b.perUnit,
      kind: "production_run" as const,
      stock: Number(b.production_run.run_stock) || 0,
    })),
  ];

  const recipeByMeal = new Map<string, typeof productMaterials>();
  for (const mi of productMaterials) {
    const list = recipeByMeal.get(mi.product_id) ?? [];
    list.push(mi);
    recipeByMeal.set(mi.product_id, list);
  }

  // Averages first, from every costed product, so each product can be placed
  // against the menu it's actually on.
  const forSplit = [...mealCosts.values()]
    .filter((mc) => mc.costed && mc.product.price > 0)
    .map((mc) => ({
      qty: soldByMeal.get(mc.product.id) ?? 0,
      gross: marginFor(mc.product.price, mc.cost, mc.costed).gross,
    }));
  const { avgQty, avgGross } = classifyMenu(forSplit);
  const anySales = forSplit.some((r) => r.qty > 0);

  const products: DishRow[] = [...mealCosts.values()].map((mc) => {
    const m = marginFor(mc.product.price, mc.cost, mc.costed);
    const sold = soldByMeal.get(mc.product.id) ?? 0;
    return {
      sold,
      // Withheld entirely until something has sold. Classifying a menu where
      // every product has sold nothing puts them all in the same box and calls
      // it insight.
      menuClass:
        anySales && mc.costed && mc.product.price > 0
          ? menuClassFor(sold, m.gross, avgQty, avgGross)
          : null,
      id: mc.product.id,
      name: mc.product.name,
      price: Number(mc.product.price) || 0,
      categories: mc.product.categories ?? [],
      onMenu: mc.product.is_public,
      available: mc.product.is_available,
      cost: mc.cost,
      costed: mc.costed,
      gross: m.gross,
      foodCostPct: m.foodCostPct,
      verdict: m.verdict,
      problems: mc.problems,
      packagingCost: packagingCost.get(mc.product.id) ?? 0,
      packaging: (packagingByMeal.get(mc.product.id) ?? []).map((r) => ({
        refType: r.ref_type as "inv" | "production_run",
        refId: r.ref_id,
        qty: Number(r.qty) || 0,
      })),
      recipe: (recipeByMeal.get(mc.product.id) ?? []).map((r) => ({
        refType: r.ref_type as "inv" | "production_run",
        refId: r.ref_id,
        qty: Number(r.qty) || 0,
      })),
      lines: mc.lines.map((l) => ({
        label: l.label,
        kind: l.kind,
        qty: l.qty,
        unit: l.unit,
        unitCost: l.unitCost,
        cost: l.cost,
        problem: l.problem,
      })),
    };
  });

  return (
    <DishCosts
      products={products}
      options={options}
      classified={anySales}
      orderPackagingCost={orderPackagingCost}
      orderPackaging={orderPackaging.map((l) => ({
        refType: l.ref_type as "inv" | "production_run",
        refId: l.ref_id,
        qty: Number(l.qty) || 0,
      }))}
      known={(catRows ?? []) as MenuCategory[]}
      failed={failed}
    />
  );
}
