import { storage } from "../storage";
import { ContificoMovementsAPI } from "./contificoMovementsAPI";
import { Store, Integration, InsertInventoryMovement } from "@shared/schema";

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
   */
  private static determineMovementType(
    eventType: string,
  ): "egreso" | "ingreso" {
    // Órdenes creadas, actualizadas y pagadas generan egresos (salidas de inventario)
    if (
      eventType === "order_paid" ||
      eventType === "orders/paid" ||
      eventType === "orders/create" ||
      eventType === "orders/updated" ||
      eventType === "order.completed"
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
        // Solo procesamos si NO existe ya un movimiento de egreso para la misma orden+SKU
        // (independientemente si vino de orders/create, orders/paid u orders/updated)
        const existingMovements = await storage.getMovementsByStore(data.storeId, 1000);
        const duplicateMovement = existingMovements.find(
          (m) => 
            m.orderId === data.orderId && 
            m.sku === item.sku &&
            m.movementType === movementType
        );

        if (duplicateMovement) {
          console.log(
            `[InventoryPush] ⚠️ Movimiento duplicado detectado para orden ${data.orderId}, SKU ${item.sku}, tipo ${movementType} (evento anterior: ${duplicateMovement.eventType}), saltando`,
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
      // Obtener el movimiento de la base de datos
      const movement = await storage.getMovementById(movementId);

      if (!movement) {
        console.error(
          `[InventoryPush] Movimiento ${movementId} no encontrado`,
        );
        return false;
      }

      // Guardar storeId para liberar lock en finally
      cachedStoreId = movement.storeId;

      console.log(
        `[InventoryPush] Procesando movimiento ${movementId}: ${movement.sku} x${movement.quantity} (${movement.movementType})`,
      );

      // Adquirir lock para prevenir conflictos con Pull sync
      const lockDuration = 5 * 60 * 1000; // 5 minutos
      const processId = `push-movement-${movementId}-${Date.now()}`;

      const lock = await storage.acquireLock(
        movement.storeId,
        'push',
        processId,
        lockDuration,
      );

      if (!lock) {
        // Si no se puede adquirir el lock, programar reintento
        console.log(
          `[InventoryPush] No se pudo adquirir lock para movimiento ${movementId}, reintentando más tarde`,
        );
        const nextAttempt = new Date(Date.now() + 2 * 60 * 1000); // Reintentar en 2 minutos
        await storage.incrementMovementAttempts(movementId, nextAttempt);
        return false;
      }

      lockAcquired = true;
      console.log(`[InventoryPush] ✅ Lock adquirido para movimiento ${movementId}`);

      // Marcar como procesando
      await storage.updateMovementStatus(
        movementId,
        "processing",
      );

      // Obtener la tienda y la integración
      const store = await storage.getStore(movement.storeId);
      if (!store) {
        throw new Error(`Tienda ${movement.storeId} no encontrada`);
      }

      const integration = await storage.getIntegration(movement.integrationId);
      if (!integration) {
        throw new Error(
          `Integración ${movement.integrationId} no encontrada`,
        );
      }

      // Obtener configuración de la integración
      const storeIntegrations = await storage.getStoreIntegrations(
        movement.storeId,
      );
      const storeIntegration = storeIntegrations.find(
        (si) => si.integrationId === movement.integrationId,
      );

      if (!storeIntegration) {
        throw new Error(
          `Integración ${movement.integrationId} no vinculada a tienda ${movement.storeId}`,
        );
      }

      // Obtener warehouse de la configuración
      // Prioridad 1: syncConfig (configuración específica de pull)
      // Prioridad 2: integration.settings.warehouse_primary (configuración global de Contifico)
      const syncConfig: any = storeIntegration.syncConfig || {};
      const integrationSettings: any = integration.settings || {};
      const warehouseId = syncConfig.pull?.warehouse || integrationSettings.warehouse_primary;

      if (!warehouseId) {
        throw new Error(
          `No se encontró bodega configurada para la tienda ${movement.storeId}. Configure una bodega en la integración de Contifico.`,
        );
      }

      console.log(`[InventoryPush] Usando bodega: ${warehouseId} para movimiento ${movementId}`);

      // Crear una tienda temporal con las credenciales de la integración
      // Usar la URL correcta de Contífico en lugar de la URL de la tienda
      const contificoStore: Store = {
        ...store,
        storeUrl: 'https://api.contifico.com',
        apiCredentials: integration.settings,
        platform: 'contifico',
      };

      // Inicializar API de Contífico
      const contificoAPI = new ContificoMovementsAPI(contificoStore);

      // Verificar stock disponible si es un egreso
      if (movement.movementType === "egreso") {
        const hasStock = await contificoAPI.checkStockAvailability(
          warehouseId,
          movement.sku,
          movement.quantity,
        );

        if (!hasStock) {
          const errorMsg = `Stock insuficiente en Contífico para SKU ${movement.sku} (requerido: ${movement.quantity})`;
          console.warn(`[InventoryPush] ⚠️ ${errorMsg}`);
          await storage.updateMovementStatus(
            movementId,
            "failed",
            errorMsg,
          );
          return false;
        }
      }

      // Enviar el movimiento a Contífico
      let response;
      if (movement.movementType === "egreso") {
        response = await contificoAPI.sendEgreso(
          warehouseId,
          movement.sku,
          movement.quantity,
          movement.orderId || undefined,
          `Orden ${movement.orderId} - ${movement.eventType}`,
        );
      } else {
        response = await contificoAPI.sendIngreso(
          warehouseId,
          movement.sku,
          movement.quantity,
          movement.orderId || undefined,
          `Orden ${movement.orderId} - ${movement.eventType}`,
        );
      }

      // Marcar como completado
      await storage.markMovementAsProcessed(movementId);

      console.log(
        `[InventoryPush] ✅ Movimiento ${movementId} procesado exitosamente`,
      );

      return true;
    } catch (error: any) {
      console.error(
        `[InventoryPush] ❌ Error procesando movimiento ${movementId}:`,
        error.message,
      );

      // Manejar error 409 (Conflict) - el movimiento ya existe en Contífico
      // En este caso, debemos marcar el movimiento como exitoso, no como fallido
      const is409Error = 
        error.response?.status === 409 ||
        error.message.includes('409') || 
        error.message.includes('Conflict');
        
      if (is409Error) {
        console.log(
          `[InventoryPush] ✅ Movimiento ${movementId} ya existe en Contífico (409 Conflict), marcando como exitoso`,
        );
        await storage.markMovementAsProcessed(movementId);
        return true;
      }

      // Obtener el movimiento actual para verificar intentos
      const movement = await storage.getMovementById(movementId);

      if (!movement) {
        console.error(`[InventoryPush] Movimiento ${movementId} no encontrado después de error`);
        return false;
      }

      // Guardar storeId si no se había guardado antes
      if (!cachedStoreId) {
        cachedStoreId = movement.storeId;
      }

      const newAttempts = movement.attempts + 1;

      // Si alcanzó el máximo de intentos, marcar como fallido
      if (newAttempts > movement.maxAttempts) {
        await storage.updateMovementStatus(
          movementId,
          "failed",
          error.message,
        );
        console.log(
          `[InventoryPush] Movimiento ${movementId} marcado como fallido después de ${movement.maxAttempts} intentos`,
        );

        // Rastrear SKU no mapeado si es ese el error
        if (error.message.includes("no encontrado")) {
          const metadata = movement.metadata as { productName?: string } | undefined;
          await storage.trackUnmappedSku({
            tenantId: movement.tenantId,
            storeId: movement.storeId,
            sku: movement.sku,
            productName:
              metadata?.productName || `Producto ${movement.sku}`,
          });
        }

        return false;
      }

      // Calcular próximo intento con backoff exponencial
      const backoffMinutes = Math.pow(2, newAttempts); // 2, 4, 8 minutos
      const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      // CRÍTICO: Volver a estado "pending" para que el worker lo recoja
      // Usar método storage para evitar condiciones de carrera y mantener invariantes
      await storage.resetMovementToPending(
        movementId,
        newAttempts,
        nextAttempt,
        error.message,
      );

      console.log(
        `[InventoryPush] Movimiento ${movementId} devuelto a 'pending' para reintento ${newAttempts} de ${movement.maxAttempts} en ${backoffMinutes} minutos`,
      );

      return false;
    } finally {
      // Liberar lock si fue adquirido, usando cachedStoreId para garantizar liberación
      if (lockAcquired && cachedStoreId) {
        try {
          await storage.releaseLock(cachedStoreId);
          console.log(`[InventoryPush] ✅ Lock liberado para tienda ${cachedStoreId}`);
        } catch (unlockError) {
          console.error(`[InventoryPush] Error liberando lock:`, unlockError);
        }
      }
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
    try {
      const pendingMovements = await storage.getPendingMovements(limit);

      console.log(
        `[InventoryPush] Procesando ${pendingMovements.length} movimientos pendientes`,
      );

      let successful = 0;
      let failed = 0;

      for (const movement of pendingMovements) {
        const result = await this.processMovement(movement.id);
        if (result) {
          successful++;
        } else {
          failed++;
        }
      }

      console.log(
        `[InventoryPush] ✅ Procesamiento completado: ${successful} exitosos, ${failed} fallidos`,
      );

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
