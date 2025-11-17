import { InventoryPushService } from "../services/inventoryPushService";
import { storage } from "../storage";

/**
 * Worker para procesar la cola de movimientos de inventario
 * Se ejecuta cada 2 minutos para enviar movimientos pendientes a Contífico
 */
export class InventoryPushWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly INTERVAL_MS = 2 * 60 * 1000; // 2 minutos

  /**
   * Inicia el worker
   */
  start(): void {
    if (this.intervalId) {
      console.log("[InventoryPushWorker] Worker ya está en ejecución");
      return;
    }

    console.log(
      `[InventoryPushWorker] Iniciando worker (intervalo: ${this.INTERVAL_MS / 1000}s)`,
    );

    // Ejecutar inmediatamente al iniciar
    this.processQueue();

    // Luego ejecutar cada 2 minutos
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.INTERVAL_MS);

    console.log("[InventoryPushWorker] ✅ Worker iniciado");
  }

  /**
   * Detiene el worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[InventoryPushWorker] Worker detenido");
    }
  }

  /**
   * Procesa la cola de movimientos pendientes
   */
  private async processQueue(): Promise<void> {
    // Evitar ejecuciones concurrentes
    if (this.isRunning) {
      console.log(
        "[InventoryPushWorker] Proceso anterior aún en ejecución, saltando...",
      );
      return;
    }

    this.isRunning = true;

    try {
      console.log(
        `[InventoryPushWorker] 🔄 Iniciando procesamiento de cola...`,
      );

      // Limpiar locks expirados antes de procesar
      await storage.cleanExpiredLocks();

      // Procesar hasta 50 movimientos por iteración
      const stats = await InventoryPushService.processPendingMovements(50);

      if (stats.processed > 0) {
        console.log(
          `[InventoryPushWorker] ✅ Procesados: ${stats.processed} | Exitosos: ${stats.successful} | Fallidos: ${stats.failed}`,
        );
      } else {
        console.log(
          `[InventoryPushWorker] No hay movimientos pendientes para procesar`,
        );
      }

      // Limpiar movimientos antiguos (más de 30 días) una vez al día
      // Verificar si es hora de limpiar (ejecutar a las 3 AM aproximadamente)
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() < 2) {
        console.log(
          "[InventoryPushWorker] Limpiando movimientos antiguos...",
        );
        await InventoryPushService.cleanOldMovements(30);
      }
    } catch (error: any) {
      console.error(
        `[InventoryPushWorker] ❌ Error procesando cola:`,
        error.message,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Obtiene el estado del worker
   */
  getStatus(): {
    running: boolean;
    intervalMs: number;
    intervalSeconds: number;
  } {
    return {
      running: this.intervalId !== null,
      intervalMs: this.INTERVAL_MS,
      intervalSeconds: this.INTERVAL_MS / 1000,
    };
  }
}

// Singleton instance
export const inventoryPushWorker = new InventoryPushWorker();
