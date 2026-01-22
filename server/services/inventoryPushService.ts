import { storage } from "../storage";
import { db } from "../db";
import { ContificoMovementsAPI } from "./contificoMovementsAPI";
import { Store, Integration, InsertInventoryMovement, InventoryMovement } from "@shared/schema";
import { SyncService } from "./SyncService";

/**
 * Datos del webhook event para queue
 */
export interface WebhookEventData {
  storeId: number;
  integrationId: number;
  tenantId: number;
  orderId: string;
  eventType: string; // 'order_paid', 'order_cancelled', 'order_refunded'
  lineItems: {
    sku: string;
    quantity: number;
    productName?: string;
  }[];
  metadata?: any;
}

/**
 * Servicio para manejar el push de inventario desde tiendas a Contífico
 * Procesa webhooks de órdenes y actualiza el inventario en Contífico
 */
export class InventoryPushService {
  /**
   * Determina el tipo de movimiento según el tipo de evento
   * @param eventType - Tipo de evento del webhook
   * @returns Tipo de movimiento ('egreso' o 'ingreso')
   *
   * IMPORTANTE: Solo orders/create genera egresos para evitar duplicados.
   * - orders/paid y orders/updated se ignoran en el webhook handler
   * - Esto previene egresos duplicados cuando Shopify envía múltiples webhooks
   */
  private static determineMovementType(
    eventType: string,
  ): "egreso" | "ingreso" {
    // Solo órdenes CREADAS generan egresos (salidas de inventario)
    // Esto evita duplicados de orders/paid y orders/updated
    if (
      eventType === "order_create" ||
      eventType === "orders/create" ||
      eventType === "order.completed" // WooCommerce
    ) {
      return "egreso";
    }

    // Cancelaciones y reembolsos generan ingresos (entradas de inventario)
    if (
      eventType === "order_cancelled" ||
      eventType === "orders/cancelled" ||
      eventType === "order.cancelled" ||
      eventType === "order_refunded" ||
      eventType === "refunds/create" ||
      eventType === "order.refunded"
    ) {
      return "ingreso";
    }

    throw new Error(`Tipo de evento desconocido: ${eventType}`);
  }

  /**
   * Encola movimientos de inventario desde un webhook event
   * @param data - Datos del evento del webhook
   * @returns Número de movimientos encolados
   */
  static async queueMovementsFromWebhook(
    data: WebhookEventData,
  ): Promise<number> {
    try {
      const movementType = this.determineMovementType(data.eventType);

      console.log(
        `[InventoryPush] Encolando ${data.lineItems.length} movimientos tipo ${movementType} para orden ${data.orderId}`,
      );

      let queuedCount = 0;

      for (const item of data.lineItems) {
        // Validar que el SKU exista
        if (!item.sku) {
          console.warn(
            `[InventoryPush] ⚠️ Producto sin SKU en orden ${data.orderId}, saltando`,
          );
          continue;
        }

        // Verificar idempotencia: evitar duplicados del mismo orderId+SKU+movementType
        // Busca directamente en la base de datos usando un índice eficiente
        // (independientemente del estado: pending, processing, completed, failed)
        const duplicateMovement = await storage.findDuplicateMovement(
          data.storeId,
          data.orderId,
          item.sku,
          movementType,
        );

        if (duplicateMovement) {
          console.log(
            `[InventoryPush] ⚠️ Movimiento duplicado detectado para orden ${data.orderId}, SKU ${item.sku}, tipo ${movementType}`,
            `(movimiento existente: #${duplicateMovement.id}, estado: ${duplicateMovement.status}, evento: ${duplicateMovement.eventType}), saltando`,
          );
          continue;
        }

        // Crear movimiento en la cola
        const movement: InsertInventoryMovement = {
          tenantId: data.tenantId,
          storeId: data.storeId,
          integrationId: data.integrationId,
          movementType,
          sku: item.sku,
          quantity: item.quantity,
          orderId: data.orderId,
          eventType: data.eventType,
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
          metadata: {
            productName: item.productName,
            originalEvent: data.metadata,
          },
        };

        await storage.queueInventoryMovement(movement);
        queuedCount++;

        console.log(
          `[InventoryPush] ✅ Encolado: ${item.sku} x${item.quantity} (${movementType})`,
        );
      }

      return queuedCount;
    } catch (error: any) {
      console.error(
        `[InventoryPush] ❌ Error encolando movimientos:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Procesa un movimiento pendiente de la cola
   * @param movementId - ID del movimiento a procesar
   * @returns true si se procesó exitosamente, false si falló
   */
  static async processMovement(movementId: number): Promise<boolean> {
    let lockAcquired = false;
    let cachedStoreId: number | null = null; // Para liberar lock incluso si movimiento se borra

    try {
      // --------------------------------------------------------
      // FASE 1: PREPARACIÓN (Transacción Atómica)
      // Adquirir lock y marcar como processing
      // --------------------------------------------------------
      const movementCheck = await storage.getMovementById(movementId);
      if (!movementCheck) {
        console.error(`[InventoryPush] Movimiento ${movementId} no encontrado (pre-check)`);
        return false;
      }
      cachedStoreId = movementCheck.storeId;

      await db.transaction(async (tx) => {
        const lockDuration = 5 * 60 * 1000; // 5 minutos
        const processId = `push-movement-${movementId}-${Date.now()}`;

        // Intentar adquirir lock dentro de la transacción
        const lock = await storage.acquireLock(
          movementCheck.storeId,
          "push",
          processId,
          lockDuration,
          tx // Pasar tx explícitamente
        );

        if (!lock) {
          // Si no se puede adquirir, lanzamos error controlado para rollbackear
          // y manejar el reintento fuera de la transacción
          throw new Error("LOCK_FAILED_RETRY");
        }

        // Marcar como procesando dentro de la transacción
        await storage.updateMovementStatus(
          movementId,
          "processing",
          undefined,
          tx
        );
      });

      // Si llegamos aquí, la transacción 1 se comiteó exitosamente
      lockAcquired = true;
      console.log(`[InventoryPush] ✅ Lock adquirido y estado processing para movimiento ${movementId}`);

      // --------------------------------------------------------
      // FASE 2: EJECUCIÓN (Sin Transacción de BD)
      // Llamadas a API externa y lógica de negocio
      // --------------------------------------------------------

      // Re-obtener movimiento
      const movement = movementCheck;

      // Obtener datos necesarios
      const store = await storage.getStore(movement.storeId);
      if (!store) throw new Error(`Tienda ${movement.storeId} no encontrada`);

      const integration = await storage.getIntegration(movement.integrationId);
      if (!integration) throw new Error(`Integración ${movement.integrationId} no encontrada`);

      const storeIntegrations = await storage.getStoreIntegrations(movement.storeId);
      const storeIntegration = storeIntegrations.find((si) => si.integrationId === movement.integrationId);
      if (!storeIntegration) throw new Error(`Integración ${movement.integrationId} no vinculada a tienda ${movement.storeId}`);

      const syncConfig: any = storeIntegration.syncConfig || {};
      const integrationSettings: any = integration.settings || {};
      const warehouseId = syncConfig.pull?.warehouse || integrationSettings.warehouse_primary;
      if (!warehouseId) throw new Error(`No se encontró bodega configurada para la tienda ${movement.storeId}`);

      console.log(`[InventoryPush] Usando bodega: ${warehouseId} para movimiento ${movementId}`);

      const contificoStore: Store = {
        ...store,
        storeUrl: 'https://api.contifico.com',
        apiCredentials: integration.settings,
        platform: 'contifico',
      };

      const contificoAPI = new ContificoMovementsAPI(contificoStore);

      // Verificación de stock para egresos
      if (movement.movementType === "egreso") {
        const hasStock = await contificoAPI.checkStockAvailability(
          warehouseId,
          movement.sku,
          movement.quantity,
        );

        if (!hasStock) {
          const errorMsg = `Stock insuficiente en Contífico para SKU ${movement.sku}`;
          console.warn(`[InventoryPush] ⚠️ ${errorMsg}`);

          await db.transaction(async (tx) => {
            await storage.updateMovementStatus(movementId, "failed", errorMsg, tx);
            await storage.releaseLock(cachedStoreId!, 'push', tx);
          });
          lockAcquired = false;

          try {
            const metadata = movement.metadata as { productName?: string } | undefined;
            await storage.trackUnmappedSku({
              tenantId: movement.tenantId,
              storeId: movement.storeId,
              sku: movement.sku,
              productName: metadata?.productName || `Producto ${movement.sku}`,
            });
          } catch (e) { console.error("Error tracking unmapped sku", e); }

          return false;
        }
      }

      // Enviar movimiento a Contífico
      const metadata = movement.metadata as any;
      const orderName = metadata?.originalEvent?.shopifyOrderName ||
        metadata?.originalEvent?.wooOrderNumber ||
        `#${movement.orderId}`;
      const description = `Pedido ${orderName} - ${movement.eventType}`;

      if (movement.movementType === "egreso") {
        await contificoAPI.sendEgreso(warehouseId, movement.sku, movement.quantity, movement.orderId || undefined, description);
      } else {
        await contificoAPI.sendIngreso(warehouseId, movement.sku, movement.quantity, movement.orderId || undefined, description);
      }

      // --------------------------------------------------------
      // FASE 3: COMPLETADO (Transacción Atómica)
      // Marcar completado y liberar lock
      // --------------------------------------------------------
      await db.transaction(async (tx) => {
        await storage.markMovementAsProcessed(movementId, tx);

        const delta = movement.movementType === "egreso" ? -movement.quantity : movement.quantity;
        try {
          await storage.updateProductStockOptimistic(movement.storeId, movement.sku, delta, 'push', tx);
          console.log(`[InventoryPush] ✅ Cache actualizado para ${movement.sku}: ${delta}`);
        } catch (cacheError: any) {
          console.warn(`[InventoryPush] ⚠️ No se pudo actualizar cache (ignorable):`, cacheError.message);
        }

        await storage.releaseLock(cachedStoreId!, 'push', tx);
      });
      lockAcquired = false;

      console.log(`[InventoryPush] ✅ Movimiento ${movementId} procesado exitosamente`);

      // Post-procesamiento
      this.triggerAutoPull(movement).catch(e => console.warn("AutoPull failed", e));

      return true;

    } catch (error: any) {
      if (error.message === "LOCK_FAILED_RETRY") {
        console.log(`[InventoryPush] Lock no adquirido, reintentando movimiento ${movementId}`);
        const nextAttempt = new Date(Date.now() + 2 * 60 * 1000);
        await storage.incrementMovementAttempts(movementId, nextAttempt);
        return false;
      }

      const is409Error = error.response?.status === 409 || error.message?.includes('409') || error.message?.includes('Conflict');

      if (is409Error) {
        console.log(`[InventoryPush] ✅ Movimiento ${movementId} ya existe (409), marcando exitoso`);

        try {
          if (lockAcquired && cachedStoreId) {
            await db.transaction(async (tx) => {
              await storage.markMovementAsProcessed(movementId, tx);
              // Intentar actualizar cache
              const movement = await storage.getMovementById(movementId);
              if (movement) {
                const delta = movement.movementType === "egreso" ? -movement.quantity : movement.quantity;
                await storage.updateProductStockOptimistic(movement.storeId, movement.sku, delta, 'push', tx).catch(() => { });
              }
              await storage.releaseLock(cachedStoreId!, 'push', tx);
            });
            lockAcquired = false;
          } else {
            await storage.markMovementAsProcessed(movementId);
          }
          return true;
        } catch (e) {
          console.error("Error recuperando de 409", e);
        }
      }

      console.error(`[InventoryPush] ❌ Error procesando movimiento ${movementId}:`, error.message);

      // FASE 4: MANEJO DE FALLO (Transacción Atómica)
      if (lockAcquired && cachedStoreId) {
        try {
          await db.transaction(async (tx) => {
            const movement = await storage.getMovementById(movementId);
            if (!movement) throw new Error("Movimiento desapareció");

            const newAttempts = movement.attempts + 1;

            if (newAttempts >= movement.maxAttempts) {
              await storage.updateMovementStatus(movementId, "failed", error.message, tx);
              console.log(`[InventoryPush] Movimiento ${movementId} marcado como failed (max attempts)`);
            } else {
              const backoffMinutes = Math.pow(2, newAttempts);
              const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);
              await storage.resetMovementToPending(movementId, newAttempts, nextAttempt, error.message, tx);
              console.log(`[InventoryPush] Movimiento ${movementId} a pending (intento ${newAttempts})`);
            }

            await storage.releaseLock(cachedStoreId!, 'push', tx);
          });
          lockAcquired = false;
        } catch (cleanupError) {
          console.error("Error crítico limpiando estado de fallo:", cleanupError);
        }
      }

      return false;
    } finally {
      if (lockAcquired && cachedStoreId) {
        try {
          console.warn(`[InventoryPush] ⚠️ Liberando lock huérfano en finally para tienda ${cachedStoreId}`);
          await storage.releaseLock(cachedStoreId, 'push');
        } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Helper para auto pull
   */
  static async triggerAutoPull(movement: any) {
    try {
      console.log(`[InventoryPush] Iniciando Pull automático para ${movement.sku}...`);
      await SyncService.pullFromIntegrationSelective(
        movement.storeId,
        movement.integrationId,
        [movement.sku],
        { dryRun: false, skipRecentPushCheck: true }
      );
      console.log(`[InventoryPush] ✅ Pull automático completado para ${movement.sku}`);
    } catch (pullError: any) {
      console.warn(`[InventoryPush] ⚠️ Pull automático falló:`, pullError.message);
    }
  }

  /**
   * Procesa todos los movimientos pendientes en la cola
   * @param limit - Número máximo de movimientos a procesar
   * @returns Estadísticas del procesamiento
   */
  static async processPendingMovements(limit: number = 50): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const startTime = Date.now();
    try {
      const pendingMovements = await storage.getPendingMovements(limit);

      console.log(
        `[InventoryPush] Procesando ${pendingMovements.length} movimientos pendientes`,
      );

      let successful = 0;
      let failed = 0;
      const processedMovements: Array<{ movement: InventoryMovement; success: boolean }> = [];

      for (const movement of pendingMovements) {
        // Check if tenant account is expired
        const tenant = await storage.getTenant(movement.tenantId);
        if (tenant?.expiresAt && new Date(tenant.expiresAt) < new Date()) {
          console.log(
            `[InventoryPush] ⏸️  Movimiento ${movement.id} - tenant ${tenant.id} expirado, saltando...`,
          );
          // Don't mark as failed, just skip - will retry when account is renewed
          continue;
        }

        const result = await this.processMovement(movement.id);
        processedMovements.push({ movement, success: result });
        if (result) {
          successful++;
        } else {
          failed++;
        }
      }

      console.log(
        `[InventoryPush] ✅ Procesamiento completado: ${successful} exitosos, ${failed} fallidos`,
      );

      // Crear sync_log de tipo "push" si se procesaron movimientos
      if (processedMovements.length > 0) {
        // Agrupar por storeId para crear un log por tienda
        const movementsByStore = new Map<number, typeof processedMovements>();
        for (const item of processedMovements) {
          const storeId = item.movement.storeId;
          if (!movementsByStore.has(storeId)) {
            movementsByStore.set(storeId, []);
          }
          movementsByStore.get(storeId)!.push(item);
        }

        // Crear un sync_log por cada tienda
        for (const [storeId, storeMovements] of Array.from(movementsByStore.entries())) {
          const storeSuccessful = storeMovements.filter(m => m.success).length;
          const storeFailed = storeMovements.filter(m => !m.success).length;

          // Obtener tenantId del primer movimiento de esta tienda
          const tenantId = storeMovements[0].movement.tenantId;
          const durationMs = Date.now() - startTime;

          try {
            // Crear el sync_log
            const syncLog = await storage.createSyncLog({
              tenantId,
              storeId,
              syncType: 'push',
              status: storeFailed === 0 ? 'success' : (storeSuccessful > 0 ? 'partial' : 'error'),
              syncedCount: storeSuccessful,
              errorCount: storeFailed,
              durationMs,
              errorMessage: storeFailed > 0 ? `${storeFailed} movimientos fallidos` : null,
              details: {
                totalMovements: storeMovements.length,
                successful: storeSuccessful,
                failed: storeFailed,
                movements: storeMovements.map(m => ({
                  sku: m.movement.sku,
                  quantity: m.movement.quantity,
                  type: m.movement.movementType,
                  orderId: m.movement.orderId,
                  success: m.success,
                })),
              },
            });

            // NO crear sync_log_items para Push porque:
            // 1. El sync_log ya tiene los detalles en el campo details.movements
            // 2. El Pull automático post-Push crea items con stock_after correcto
            // 3. Items de Push con stock_after=null contaminan los datos
            console.log(
              `[InventoryPush] ✅ Sync log creado para tienda ${storeId}: ${storeSuccessful} exitosos, ${storeFailed} fallidos (sin items - el Pull automático los crea)`,
            );
          } catch (logError: any) {
            console.error(
              `[InventoryPush] ⚠️ Error creando sync log para tienda ${storeId}:`,
              logError.message,
            );
          }
        }
      }

      return {
        processed: pendingMovements.length,
        successful,
        failed,
      };
    } catch (error: any) {
      console.error(
        `[InventoryPush] ❌ Error procesando movimientos:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Limpia movimientos antiguos completados o fallidos
   * @param daysOld - Días de antigüedad para limpiar
   * @returns void
   */
  static async cleanOldMovements(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      await storage.deleteOldMovements(cutoffDate);
      console.log(
        `[InventoryPush] Movimientos antiguos limpiados (anteriores a ${cutoffDate.toISOString()})`,
      );
    } catch (error: any) {
      console.error(
        `[InventoryPush] Error limpiando movimientos antiguos:`,
        error.message,
      );
    }
  }
}
