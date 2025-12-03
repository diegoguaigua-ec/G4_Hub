#!/usr/bin/env tsx
/**
 * Script para limpiar movimientos atascados en producción
 *
 * Casos que maneja:
 * 1. Movimientos duplicados (mismo orderId+SKU+movementType)
 * 2. Movimientos con 2-3 intentos que llevan días atascados
 * 3. Movimientos con error de "Stock insuficiente"
 *
 * Uso:
 *   tsx scripts/cleanup-stuck-movements.ts [--dry-run] [--days=7] [--store-id=1]
 */

import { db } from "../server/db";
import { inventoryMovementsQueue } from "../shared/schema";
import { sql, and, eq, or, lt, gte } from "drizzle-orm";

interface CleanupStats {
  duplicates: number;
  stuckPending: number;
  insufficientStock: number;
  total: number;
}

async function cleanupStuckMovements(options: {
  dryRun?: boolean;
  daysOld?: number;
  storeId?: number;
}): Promise<CleanupStats> {
  const { dryRun = false, daysOld = 7, storeId } = options;
  const stats: CleanupStats = {
    duplicates: 0,
    stuckPending: 0,
    insufficientStock: 0,
    total: 0,
  };

  console.log("🧹 Iniciando limpieza de movimientos atascados...");
  console.log(`   Modo: ${dryRun ? "DRY RUN (no se harán cambios)" : "PRODUCCIÓN"}`);
  console.log(`   Antigüedad: ${daysOld} días`);
  if (storeId) console.log(`   Tienda: ${storeId}`);
  console.log("");

  // 1. Encontrar movimientos duplicados
  console.log("📊 Buscando movimientos duplicados...");

  const duplicatesQuery = db
    .select({
      orderId: inventoryMovementsQueue.orderId,
      sku: inventoryMovementsQueue.sku,
      movementType: inventoryMovementsQueue.movementType,
      storeId: inventoryMovementsQueue.storeId,
      count: sql<number>`count(*)::int`,
      ids: sql<number[]>`array_agg(${inventoryMovementsQueue.id} ORDER BY ${inventoryMovementsQueue.createdAt})`,
    })
    .from(inventoryMovementsQueue)
    .where(
      and(
        storeId ? eq(inventoryMovementsQueue.storeId, storeId) : undefined,
      )
    )
    .groupBy(
      inventoryMovementsQueue.orderId,
      inventoryMovementsQueue.sku,
      inventoryMovementsQueue.movementType,
      inventoryMovementsQueue.storeId,
    )
    .having(sql`count(*) > 1`);

  const duplicates = await duplicatesQuery;

  for (const duplicate of duplicates) {
    const [firstId, ...restIds] = duplicate.ids;
    console.log(
      `   🔍 Duplicado encontrado: Orden ${duplicate.orderId}, SKU ${duplicate.sku}, tipo ${duplicate.movementType}`,
    );
    console.log(`      Movimientos: ${duplicate.ids.join(", ")} (manteniendo ${firstId})`);

    if (!dryRun && restIds.length > 0) {
      await db
        .delete(inventoryMovementsQueue)
        .where(
          sql`${inventoryMovementsQueue.id} = ANY(${restIds})`,
        );
      stats.duplicates += restIds.length;
    }
  }

  console.log(`   ✅ ${duplicates.length} grupos de duplicados encontrados (${stats.duplicates} movimientos eliminados)`);
  console.log("");

  // 2. Movimientos atascados en "pending" con muchos intentos
  console.log("📊 Buscando movimientos atascados (2-3 intentos)...");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const stuckMovements = await db
    .select()
    .from(inventoryMovementsQueue)
    .where(
      and(
        storeId ? eq(inventoryMovementsQueue.storeId, storeId) : undefined,
        or(
          eq(inventoryMovementsQueue.status, "pending"),
          eq(inventoryMovementsQueue.status, "processing"),
        ),
        gte(inventoryMovementsQueue.attempts, 2),
        lt(inventoryMovementsQueue.createdAt, cutoffDate),
      ),
    );

  for (const movement of stuckMovements) {
    console.log(
      `   🔍 Movimiento atascado: #${movement.id}, Orden ${movement.orderId}, SKU ${movement.sku}`,
    );
    console.log(`      Estado: ${movement.status}, Intentos: ${movement.attempts}/${movement.maxAttempts}`);
    console.log(`      Error: ${movement.errorMessage || "N/A"}`);

    if (!dryRun) {
      await db
        .update(inventoryMovementsQueue)
        .set({
          status: "failed",
          errorMessage: movement.errorMessage ||
            `Movimiento atascado - marcado como fallido automáticamente después de ${daysOld} días`,
        })
        .where(eq(inventoryMovementsQueue.id, movement.id));
      stats.stuckPending++;
    }
  }

  console.log(`   ✅ ${stuckMovements.length} movimientos atascados marcados como fallidos`);
  console.log("");

  // 3. Movimientos con error de "Stock insuficiente" que están en pending/processing
  console.log("📊 Buscando movimientos con stock insuficiente...");

  const insufficientStockMovements = await db
    .select()
    .from(inventoryMovementsQueue)
    .where(
      and(
        storeId ? eq(inventoryMovementsQueue.storeId, storeId) : undefined,
        or(
          eq(inventoryMovementsQueue.status, "pending"),
          eq(inventoryMovementsQueue.status, "processing"),
        ),
        sql`${inventoryMovementsQueue.errorMessage} LIKE '%Stock insuficiente%'`,
      ),
    );

  for (const movement of insufficientStockMovements) {
    console.log(
      `   🔍 Stock insuficiente: #${movement.id}, Orden ${movement.orderId}, SKU ${movement.sku}`,
    );

    if (!dryRun) {
      await db
        .update(inventoryMovementsQueue)
        .set({
          status: "failed",
        })
        .where(eq(inventoryMovementsQueue.id, movement.id));
      stats.insufficientStock++;
    }
  }

  console.log(`   ✅ ${insufficientStockMovements.length} movimientos con stock insuficiente marcados como fallidos`);
  console.log("");

  stats.total = stats.duplicates + stats.stuckPending + stats.insufficientStock;

  return stats;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const storeIdArg = args.find((arg) => arg.startsWith("--store-id="));

  const daysOld = daysArg ? parseInt(daysArg.split("=")[1]) : 7;
  const storeId = storeIdArg ? parseInt(storeIdArg.split("=")[1]) : undefined;

  try {
    const stats = await cleanupStuckMovements({ dryRun, daysOld, storeId });

    console.log("═══════════════════════════════════════");
    console.log("📊 RESUMEN DE LIMPIEZA:");
    console.log(`   Duplicados eliminados: ${stats.duplicates}`);
    console.log(`   Movimientos atascados marcados como fallidos: ${stats.stuckPending}`);
    console.log(`   Movimientos con stock insuficiente: ${stats.insufficientStock}`);
    console.log(`   TOTAL: ${stats.total} movimientos procesados`);
    console.log("═══════════════════════════════════════");

    if (dryRun) {
      console.log("");
      console.log("⚠️  DRY RUN - No se realizaron cambios");
      console.log("   Ejecute sin --dry-run para aplicar los cambios");
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error durante la limpieza:", error.message);
    process.exit(1);
  }
}

main();
