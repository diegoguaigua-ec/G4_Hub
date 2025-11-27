import { storage } from './storage';
import { SyncService } from './services/SyncService';

interface SyncConfig {
  pull?: {
    enabled?: boolean;
    interval?: '5min' | '30min' | 'hourly' | 'daily' | 'weekly';
    warehouse?: string;
  };
  schedule?: {
    activeHours?: {
      start: string; // "HH:mm"
      end: string;   // "HH:mm"
    };
    timezone?: string;
  };
}

export class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the scheduler - runs every 5 minutes to support all intervals
   */
  start() {
    if (this.intervalId) {
      console.log('[Scheduler] Ya está ejecutándose');
      return;
    }

    console.log('[Scheduler] Iniciando scheduler - se ejecutará cada 5 minutos');

    // Run immediately on start
    this.runScheduledSyncs();

    // Then run every 5 minutes (to support the smallest interval)
    this.intervalId = setInterval(() => {
      this.runScheduledSyncs();
    }, 5 * 60 * 1000); // 5 minutos en milisegundos
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Scheduler detenido');
    }
  }

  /**
   * Run all scheduled syncs
   */
  private async runScheduledSyncs() {
    if (this.isRunning) {
      console.log('[Scheduler] Ya hay una ejecución en progreso, saltando...');
      return;
    }

    this.isRunning = true;
    console.log('[Scheduler] ========================================');
    console.log(`[Scheduler] Ejecutando sincronizaciones programadas - ${new Date().toLocaleString()}`);
    console.log('[Scheduler] ========================================');

    try {
      // Get all stores from all tenants
      const tenants = await storage.getAllTenants();

      for (const tenant of tenants) {
        // Skip expired accounts - automatic syncs are suspended
        if (tenant.expiresAt && new Date(tenant.expiresAt) < new Date()) {
          console.log(`[Scheduler] ⏸️  Tenant ${tenant.id} (${tenant.name}) - cuenta expirada, sincronizaciones suspendidas`);
          continue;
        }

        // Skip non-approved accounts
        if (tenant.accountStatus !== 'approved') {
          console.log(`[Scheduler] ⏸️  Tenant ${tenant.id} (${tenant.name}) - cuenta no aprobada`);
          continue;
        }

        const stores = await storage.getStoresByTenant(tenant.id);

        for (const store of stores) {
          try {
            await this.processStore(store, tenant);
          } catch (error: any) {
            console.error(`[Scheduler] Error procesando store ${store.id}:`, error.message);
          }
        }
      }

      console.log('[Scheduler] ✅ Ejecución de sincronizaciones completada');
    } catch (error: any) {
      console.error('[Scheduler] ❌ Error en runScheduledSyncs:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single store - check if sync should run
   */
  private async processStore(store: any, tenant: any) {
    // Get store integrations
    const storeIntegrations = await storage.getStoreIntegrations(store.id);

    for (const link of storeIntegrations) {
      if (!link.isActive) {
        continue;
      }

      const syncConfig = (link.syncConfig || {}) as SyncConfig;

      // Check if pull sync is enabled
      if (!syncConfig.pull?.enabled) {
        continue;
      }

      // Get integration details
      const integration = await storage.getIntegration(link.integrationId);
      if (!integration || integration.integrationType !== 'contifico') {
        continue;
      }

      // Check if we're within active hours (if configured)
      if (!this.isWithinActiveHours(syncConfig)) {
        console.log(`[Scheduler] Store ${store.id} fuera de horario activo, saltando...`);
        continue;
      }

      // Check if sync should run based on interval
      if (!this.shouldRunSync(store, syncConfig)) {
        console.log(`[Scheduler] Store ${store.id} no necesita sincronización aún según intervalo`);
        continue;
      }

      // Run the sync
      console.log(`[Scheduler] 🚀 Iniciando sincronización automática para store ${store.id} (${store.storeName})`);

      try {
        const result = await SyncService.pullFromIntegration(
          store.id,
          integration.id,
          { dryRun: false, limit: 1000 }
        );

        console.log(`[Scheduler] ✅ Sincronización completada para store ${store.id}`);
        console.log(`[Scheduler]    - Éxitos: ${result.success}`);
        console.log(`[Scheduler]    - Fallidos: ${result.failed}`);
        console.log(`[Scheduler]    - Omitidos: ${result.skipped}`);

        // Check if there were significant failures that warrant a notification
        if (result.failed > 0 && result.failed >= result.success) {
          // More failures than successes - create error notification
          await storage.createNotification({
            tenantId: tenant.id,
            userId: null,
            storeId: store.id,
            type: 'sync_failure',
            title: 'Sincronización automática con errores',
            message: `La sincronización automática falló para ${result.failed} productos de ${result.failed + result.success} total. Revisa los logs para más detalles.`,
            severity: 'error',
            read: false,
            data: {
              syncType: 'pull',
              success: result.success,
              failed: result.failed,
              skipped: result.skipped,
              automated: true,
            },
          });
        }
      } catch (error: any) {
        console.error(`[Scheduler] ❌ Error en sincronización de store ${store.id}:`, error.message);

        // Create error notification
        await storage.createNotification({
          tenantId: tenant.id,
          userId: null,
          storeId: store.id,
          type: 'sync_failure',
          title: 'Error en sincronización automática',
          message: `La sincronización automática falló completamente: ${error.message}`,
          severity: 'error',
          read: false,
          data: {
            syncType: 'pull',
            error: error.message,
            automated: true,
          },
        });
      }
    }
  }

  /**
   * Check if current time is within configured active hours
   */
  private isWithinActiveHours(syncConfig: SyncConfig): boolean {
    if (!syncConfig.schedule?.activeHours) {
      return true; // No restrictions
    }

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHours * 60 + currentMinutes;

    const { start, end } = syncConfig.schedule.activeHours;

    const [startHours, startMinutes] = start.split(':').map(Number);
    const startTime = startHours * 60 + startMinutes;

    const [endHours, endMinutes] = end.split(':').map(Number);
    const endTime = endHours * 60 + endMinutes;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Check if sync should run based on interval and last sync time
   */
  private shouldRunSync(store: any, syncConfig: SyncConfig): boolean {
    if (!syncConfig.pull?.interval) {
      return false;
    }

    if (!store.lastSyncAt) {
      return true; // Never synced, run now
    }

    const lastSync = new Date(store.lastSyncAt);
    const now = new Date();
    const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);

    switch (syncConfig.pull.interval) {
      case '5min':
        return minutesSinceLastSync >= 5;
      case '30min':
        return minutesSinceLastSync >= 30;
      case 'hourly':
        return minutesSinceLastSync >= 60;
      case 'daily':
        return minutesSinceLastSync >= 1440; // 24 * 60
      case 'weekly':
        return minutesSinceLastSync >= 10080; // 7 * 24 * 60
      default:
        return false;
    }
  }
}

// Create and export a singleton instance
export const scheduler = new Scheduler();
