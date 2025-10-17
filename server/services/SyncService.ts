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
   * ESTRATEGIA: Partir desde los productos de la tienda, no desde Contífico
   */
  static async pullFromIntegration(
    storeId: number,
    integrationId: number,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const { dryRun = false, limit } = options;
    const startTime = Date.now();

    console.log(`[Sync] Iniciando Pull: Store ${storeId}, Integration ${integrationId}`);
    console.log(`[Sync] Opciones: dryRun=${dryRun}, limit=${limit || 'sin límite'}`);

    const results: SyncResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // ✅ Array para almacenar items a guardar
    const itemsToSave: Array<any> = [];
    let syncLogId: number | null = null;

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

      // 4. Crear conectores
      const storeConnector = this.getStoreConnector(store);

      const settings = integration.settings as any;
      const contificoStore = {
        id: 0,
        tenantId: integration.tenantId,
        platform: 'contifico',
        storeName: integration.name,
        storeUrl: 'https://api.contifico.com',
        apiCredentials: settings,
        syncConfig: {},
        status: 'active' as const,
        connectionStatus: 'connected' as const,
        lastConnectionTest: null,
        storeInfo: {},
        productsCount: 0,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const contificoConnector = new ContificoConnector(contificoStore);

      // ✅ Obtener nombre de bodega
      const warehouseName = settings.warehouse_primary 
        ? await this.getWarehouseName(contificoConnector, settings.warehouse_primary)
        : 'Stock Global';

      // 5. ESTRATEGIA CORRECTA: Obtener productos de la TIENDA que tienen SKU
      console.log(`[Sync] Obteniendo productos de ${store.platform} que tienen SKU...`);
      const storeProducts = await storeConnector.getProductsWithSku();

      // Aplicar límite si se especificó
      const productsToSync = limit ? storeProducts.slice(0, limit) : storeProducts;

      console.log(`[Sync] ${productsToSync.length} productos con SKU encontrados en la tienda`);
      console.log(`[Sync] Sincronizando inventario desde Contífico...`);

      // 6. Procesar por lotes (de 20 en 20 para no saturar las APIs)
      const batchSize = 20;
      let processedCount = 0;

      for (let i = 0; i < productsToSync.length; i += batchSize) {
        const batch = productsToSync.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(productsToSync.length / batchSize);

        console.log(`[Sync] Procesando lote ${batchNumber}/${totalBatches} (${batch.length} productos)`);

        // Procesar cada producto del lote en paralelo
        await Promise.all(
          batch.map(async (storeProduct) => {
            // ✅ Crear registro base del item DENTRO del map
            const itemRecord: any = {
              syncLogId: 0, // Se actualizará después
              sku: storeProduct.sku,
              productId: storeProduct.variant_id.toString(),
              productName: storeProduct.title,
              status: 'skipped',
              stockBefore: storeProduct.inventory_quantity,
              stockAfter: storeProduct.inventory_quantity,
              errorCategory: null,
              errorMessage: null,
            };

            try {
              const { 
                sku, 
                variant_id, 
                inventory_quantity: currentStock, 
                title, 
                inventory_item_id 
              } = storeProduct;

              console.log(`[Sync] Procesando: ${sku} - ${title}`);

              // 1. Buscar producto en Contífico por SKU
              let contificoProductResult;
              try {
                contificoProductResult = await contificoConnector.getProduct(sku);
              } catch (error: any) {
                console.log(`[Sync] ⚠️ Producto ${sku} no encontrado en Contífico, omitiendo`);
                results.skipped++;

                // ✅ Guardar item omitido
                itemRecord.status = 'skipped';
                itemRecord.errorCategory = 'not_found_contifico';
                itemRecord.errorMessage = 'Producto no encontrado en Contífico';
                itemsToSave.push(itemRecord);
                return;
              }

              if (!contificoProductResult.product) {
                console.log(`[Sync] ⚠️ Producto ${sku} no encontrado en Contífico, omitiendo`);
                results.skipped++;

                // ✅ Guardar item omitido
                itemRecord.status = 'skipped';
                itemRecord.errorCategory = 'not_found_contifico';
                itemRecord.errorMessage = 'Producto no encontrado en Contífico';
                itemsToSave.push(itemRecord);
                return;
              }

              const contificoProduct = contificoProductResult.product;

              // 2. Obtener stock (global o por bodega específica)
              let contificoStock: number;

              if (settings.warehouse_primary) {
                // CON bodega configurada: consultar stock específico
                console.log(`[Sync] Consultando stock de bodega ${settings.warehouse_primary} para ${sku}`);

                try {
                  contificoStock = await contificoConnector.getProductStock(
                    contificoProduct.id,
                    sku
                  );
                  console.log(`[Sync] Stock en bodega ${settings.warehouse_primary}: ${contificoStock}`);
                } catch (error: any) {
                  console.warn(`[Sync] Error obteniendo stock de bodega para ${sku}, usando stock global`);
                  contificoStock = contificoProduct.stock_quantity || 0;
                }
              } else {
                // SIN bodega: usar stock global
                contificoStock = contificoProduct.stock_quantity || 0;
                console.log(`[Sync] Stock global: ${contificoStock}`);
              }

              // 3. Comparar stocks
              if (currentStock === contificoStock) {
                console.log(`[Sync] ✓ Stock igual (${contificoStock}), omitiendo: ${sku}`);
                results.skipped++;

                // ✅ Guardar item omitido
                itemRecord.status = 'skipped';
                itemRecord.errorCategory = 'no_changes';
                itemRecord.errorMessage = 'Stock sin cambios';
                itemsToSave.push(itemRecord);
                return;
              }

              console.log(`[Sync] Stock diferente: Tienda=${currentStock}, Contífico=${contificoStock}`);

              // 4. Actualizar stock en la tienda
              if (!dryRun) {
                try {
                  if (store.platform === 'shopify' && inventory_item_id) {
                    // Shopify: Actualizar usando variant_id + inventory_item_id
                    await (storeConnector as ShopifyConnector).updateVariantStock!(
                      variant_id,
                      inventory_item_id,
                      Math.floor(contificoStock)
                    );
                  } else if (store.platform === 'woocommerce') {
                    // WooCommerce: Actualizar usando product_id
                    await (storeConnector as WooCommerceConnector).updateProductStock!(
                      variant_id,
                      Math.floor(contificoStock)
                    );
                  } else {
                    throw new Error(`Plataforma ${store.platform} no soportada para actualización de stock`);
                  }

                  console.log(`[Sync] ✅ Actualizado: ${sku} → ${contificoStock} unidades`);
                  results.success++;

                  // ✅ Guardar item exitoso
                  itemRecord.status = 'success';
                  itemRecord.stockAfter = Math.floor(contificoStock);
                  itemsToSave.push(itemRecord);

                } catch (updateError: any) {
                  console.error(`[Sync] ❌ Error actualizando stock para ${sku}:`, updateError.message);
                  results.failed++;
                  results.errors.push({
                    sku,
                    error: `Error al actualizar stock: ${updateError.message}`
                  });

                  // ✅ Guardar item fallido
                  itemRecord.status = 'failed';
                  itemRecord.errorCategory = 'update_error';
                  itemRecord.errorMessage = updateError.message;
                  itemsToSave.push(itemRecord);
                }
              } else {
                console.log(`[Sync] [DRY-RUN] Se actualizaría: ${sku} → ${contificoStock} unidades`);
                results.success++;

                // ✅ En dry-run también guardamos como éxito
                itemRecord.status = 'success';
                itemRecord.stockAfter = Math.floor(contificoStock);
                itemsToSave.push(itemRecord);
              }

            } catch (error: any) {
              console.error(`[Sync] ❌ Error procesando producto ${storeProduct.sku}:`, error.message);
              results.failed++;
              results.errors.push({
                sku: storeProduct.sku || 'unknown',
                error: error.message
              });

              // ✅ Guardar item con error general
              itemRecord.status = 'failed';
              itemRecord.errorCategory = 'processing_error';
              itemRecord.errorMessage = error.message;
              itemsToSave.push(itemRecord);
            }
          })
        );

        processedCount += batch.length;
        console.log(`[Sync] Progreso: ${processedCount}/${productsToSync.length} productos procesados`);

        // Pequeña pausa entre lotes para no saturar las APIs
        if (i + batchSize < productsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const durationMs = Date.now() - startTime;

      // 7. Registrar el resultado de la sincronización
      if (!dryRun) {
        const syncLog = await storage.createSyncLog({
          tenantId: store.tenantId,
          storeId: store.id,
          syncType: 'pull',
          status: results.failed > 0 ? 'partial' : 'success',
          syncedCount: results.success,
          errorCount: results.failed,
          durationMs,
          errorMessage: null,
          details: {
            integration_id: integrationId,
            warehouse_id: settings.warehouse_primary || null,
            warehouse_name: warehouseName,
            total_found_in_store: storeProducts.length,
            total_processed: productsToSync.length,
            success: results.success,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors.slice(0, 20)
          }
        });

        syncLogId = syncLog.id;

        // ✅ NUEVO: Guardar todos los items procesados
        if (itemsToSave.length > 0) {
          // Actualizar syncLogId en todos los items
          const itemsWithLogId = itemsToSave.map(item => ({
            ...item,
            syncLogId: syncLog.id
          }));

          await storage.createSyncLogItems(itemsWithLogId);
          console.log(`[Sync] ✅ Guardados ${itemsWithLogId.length} items en sync_log_items`);
        }

        // Actualizar última sincronización
        await storage.updateStore(storeId, {
          lastSyncAt: new Date()
        });
      }

      console.log(`[Sync] ========================================`);
      console.log(`[Sync] Sincronización completada en ${(durationMs / 1000).toFixed(2)}s`);
      console.log(`[Sync] ✅ Éxitos: ${results.success}`);
      console.log(`[Sync] ❌ Fallidos: ${results.failed}`);
      console.log(`[Sync] ⏭️  Omitidos: ${results.skipped}`);
      console.log(`[Sync] ========================================`);

      return results;

    } catch (error: any) {
      console.error('[Sync] ❌ Error fatal en sincronización:', error);

      const durationMs = Date.now() - startTime;

      // Registrar fallo
      try {
        const store = await storage.getStore(storeId);
        if (store) {
          const syncLog = await storage.createSyncLog({
            tenantId: store.tenantId,
            storeId,
            syncType: 'pull',
            status: 'error',
            syncedCount: results.success,
            errorCount: results.failed + 1,
            durationMs,
            errorMessage: error.message?.substring(0, 200) || 'Unknown error',
            details: { 
              integration_id: integrationId,
              fatal_error: true,
              partial_results: {
                success: results.success,
                failed: results.failed,
                skipped: results.skipped
              }
            }
          });

          // ✅ Guardar items parciales si existen
          if (itemsToSave.length > 0) {
            const itemsWithLogId = itemsToSave.map(item => ({
              ...item,
              syncLogId: syncLog.id
            }));
            await storage.createSyncLogItems(itemsWithLogId);
          }
        }
      } catch (logError) {
        console.error('[Sync] Error al registrar log de fallo:', logError);
      }

      throw error;
    }
  }

  /**
   * Obtiene el nombre de una bodega desde Contífico
   */
  private static async getWarehouseName(
    contificoConnector: ContificoConnector,
    warehouseId: string
  ): Promise<string> {
    try {
      const warehouses = await contificoConnector.getWarehouses();
      const warehouse = warehouses.find(w => w.id === warehouseId);
      return warehouse?.nombre || warehouseId;
    } catch (error) {
      console.warn('[Sync] No se pudo obtener nombre de bodega, usando ID');
      return warehouseId;
    }
  }
}