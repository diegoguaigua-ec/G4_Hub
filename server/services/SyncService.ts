import { storage } from '../storage';
import { ContificoConnector } from '../connectors/ContificoConnector';
import { BaseConnector } from '../connectors/BaseConnector';
import { WooCommerceConnector } from '../connectors/WooCommerceConnector';
import { ShopifyConnector } from '../connectors/ShopifyConnector';

interface SyncResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{
    sku: string;
    error: string;
  }>;
}

interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
}

export class SyncService {
  /**
   * Obtiene el conector apropiado para una tienda
   */
  private static getStoreConnector(store: any): BaseConnector {
    switch (store.platform) {
      case 'woocommerce':
        return new WooCommerceConnector(store);
      case 'shopify':
        return new ShopifyConnector(store);
      default:
        throw new Error(`Plataforma no soportada: ${store.platform}`);
    }
  }

  /**
   * Sincroniza productos desde Contífico hacia una tienda (Pull)
   */
  static async pullFromIntegration(
    storeId: number,
    integrationId: number,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const { dryRun = false, limit = 1000 } = options;
    const startTime = Date.now();

    console.log(`[Sync] Iniciando Pull: Store ${storeId}, Integration ${integrationId}`);
    console.log(`[Sync] Opciones: dryRun=${dryRun}, limit=${limit}`);

    const results: SyncResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      // 1. Obtener la tienda y verificar que existe
      const store = await storage.getStore(storeId);
      if (!store) {
        throw new Error(`Tienda ${storeId} no encontrada`);
      }

      // 2. Obtener la integración y verificar que existe
      const integration = await storage.getIntegration(integrationId);
      if (!integration) {
        throw new Error(`Integración ${integrationId} no encontrada`);
      }

      // 3. Verificar que ambos pertenecen al mismo tenant
      if (store.tenantId !== integration.tenantId) {
        throw new Error('La tienda y la integración no pertenecen al mismo tenant');
      }

      console.log(`[Sync] Store: ${store.storeName} (${store.platform})`);
      console.log(`[Sync] Integration: ${integration.name} (${integration.integrationType})`);

      // 4. Crear store temporal para Contífico usando los settings de la integración
      const settings = integration.settings as any;
      const contificoStore = {
        id: 0,
        tenantId: integration.tenantId,
        platform: 'contifico',
        storeName: integration.name,
        storeUrl: 'https://api.contifico.com',
        apiCredentials: settings,
        syncConfig: {},
        status: 'active',
        connectionStatus: 'connected',
        lastConnectionTest: null,
        storeInfo: {},
        productsCount: 0,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 5. Crear conectores
      const contificoConnector = new ContificoConnector(contificoStore);
      const storeConnector = this.getStoreConnector(store);

      // 6. Obtener productos de Contífico
      console.log(`[Sync] Obteniendo productos de Contífico...`);
      const contificoProducts = await contificoConnector.getProducts(1, limit);

      console.log(`[Sync] Productos obtenidos: ${contificoProducts.products.length}`);

      // 7. Sincronizar cada producto
      for (const contificoProduct of contificoProducts.products) {
        try {
          const sku = contificoProduct.sku;

          // Validar SKU
          if (!sku || sku.trim() === '') {
            console.log(`[Sync] ⚠️ Producto sin SKU, omitiendo: ${contificoProduct.name}`);
            results.skipped++;
            continue;
          }

          console.log(`[Sync] Procesando: ${sku} - ${contificoProduct.name}`);

          // Buscar producto en la tienda por SKU
          let storeProduct;
          try {
            storeProduct = await storeConnector.getProduct(sku);
          } catch (error) {
            console.log(`[Sync] Producto ${sku} no encontrado en tienda, omitiendo`);
            results.skipped++;
            continue;
          }

          // Comparar stocks
          const contificoStock = contificoProduct.stock_quantity || 0;
          const storeStock = storeProduct.product?.stock_quantity || 0;

          if (contificoStock === storeStock) {
            console.log(`[Sync] ✓ Stock igual (${contificoStock}), omitiendo: ${sku}`);
            results.skipped++;
            continue;
          }

          console.log(`[Sync] Stock diferente: Contífico=${contificoStock}, Tienda=${storeStock}`);

          // Actualizar stock en la tienda (si no es dry run)
          if (!dryRun) {
            await storeConnector.updateProduct(storeProduct.product!.id, {
              stock_quantity: contificoStock
            });
            console.log(`[Sync] ✅ Actualizado: ${sku} → ${contificoStock} unidades`);
          } else {
            console.log(`[Sync] [DRY-RUN] Se actualizaría: ${sku} → ${contificoStock} unidades`);
          }

          results.success++;

        } catch (error: any) {
          console.error(`[Sync] ❌ Error procesando producto ${contificoProduct.sku}:`, error.message);
          results.failed++;
          results.errors.push({
            sku: contificoProduct.sku || 'unknown',
            error: error.message
          });
        }
      }

      const durationMs = Date.now() - startTime;

      // 8. Registrar el resultado de la sincronización
      if (!dryRun) {
        await storage.createSyncLog({
          tenantId: store.tenantId,
          storeId: store.id,
          syncType: 'pull',
          status: results.failed > 0 ? 'completed_with_errors' : 'completed',
          syncedCount: results.success,
          errorCount: results.failed,
          durationMs,
          errorMessage: null, // Sin error general, solo errores individuales en details
          details: {
            integration_id: integrationId,
            total_processed: contificoProducts.products.length,
            skipped: results.skipped,
            errors: results.errors.slice(0, 10) // Solo primeros 10 errores
          }
        });

        // Actualizar última sincronización
        await storage.updateStore(storeId, {
          lastSyncAt: new Date()
        });
      }

      console.log(`[Sync] Completado en ${durationMs}ms: ${results.success} exitosos, ${results.failed} fallidos, ${results.skipped} omitidos`);

      return results;

    } catch (error: any) {
      console.error('[Sync] Error fatal en sincronización:', error);

      // Registrar fallo
      const durationMs = Date.now() - startTime;

      try {
        const store = await storage.getStore(storeId);
        await storage.createSyncLog({
          tenantId: store?.tenantId || 0,
          storeId,
          syncType: 'pull',
          status: 'failed',
          syncedCount: 0,
          errorCount: 1,
          durationMs,
          errorMessage: error.message,
          details: { integration_id: integrationId }
        });
      } catch (logError) {
        console.error('[Sync] Error al registrar log de fallo:', logError);
      }

      throw error;
    }
  }
}