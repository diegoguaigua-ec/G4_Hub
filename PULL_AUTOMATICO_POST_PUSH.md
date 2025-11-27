# Pull Automático Post-Push

## Problema Identificado

Después de implementar Fase 1 y Fase 2, se identificó un problema en la tabla de inventario:

**Síntoma:**
```
SKU             Stock Tienda    Stock Contifico    Estado      Última Actualización
PT-0002-50ml    101             —                  Pendiente   Nunca
```

**Causa:**
- Cuando ocurre un Push (venta), se actualiza el stock en Contifico ✓
- Se actualiza el cache local (stock tienda) ✓
- Pero NO se actualiza la información de sincronización en `sync_logs`
- El endpoint `/api/sync-status` solo lee de `sync_logs` (que viene de Pulls)
- Por eso muestra "Stock Contifico: —" y "Última Actualización: Nunca"

## Solución Implementada

### Opción Elegida: Pull Automático Post-Push

Después de cada Push exitoso, se ejecuta automáticamente un Pull selectivo del producto que se acaba de enviar a Contifico.

**Ventajas:**
- ✅ Datos siempre reales y actualizados
- ✅ No hay estimaciones
- ✅ Sincronización automática
- ✅ Usuario siempre ve información correcta

**Desventajas:**
- ⚠️ 1 llamada adicional a la API por cada Push
- ⚠️ Ligero aumento en latencia de procesamiento

## Cambios Implementados

### 1. **server/services/inventoryPushService.ts**

Agregado Pull automático después de actualizar el cache:

```typescript
// Después del cache update...

// Ejecutar Pull automático para obtener datos actualizados de Contifico
try {
  console.log(`[InventoryPush] Iniciando Pull automático para ${movement.sku}...`);

  await SyncService.pullFromIntegrationSelective(
    movement.storeId,
    movement.integrationId,
    [movement.sku],
    {
      dryRun: false,
      skipRecentPushCheck: true // Omitir verificación porque este Pull es post-Push
    }
  );

  console.log(`[InventoryPush] ✅ Pull automático completado para ${movement.sku}`);
} catch (pullError: any) {
  // No fallar el movimiento si el Pull automático falla
  console.warn(
    `[InventoryPush] ⚠️ No se pudo ejecutar Pull automático para ${movement.sku}:`,
    pullError.message,
  );
}
```

**Importante:**
- El Pull no hace fallar el Push si hay un error
- Se ejecuta dentro del lock de Push (que no interfiere con locks de Pull por ser granulares)

### 2. **server/services/SyncService.ts**

Agregado parámetro `skipRecentPushCheck` para evitar conflictos:

```typescript
interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
  skipRecentPushCheck?: boolean; // Para Pull automático post-Push
}
```

**Modificaciones en métodos Pull:**

```typescript
// En pullFromIntegration y pullFromIntegrationSelective:
const { dryRun = false, limit, skipRecentPushCheck = false } = options;

// En verificación de pushes recientes:
if (!skipRecentPushCheck) {
  const hasRecentPush = await storage.hasRecentPushMovements(store.id, sku, 5);
  if (hasRecentPush) {
    // Omitir actualización...
  }
}
```

**¿Por qué esto es necesario?**

Sin este parámetro, el Pull automático detectaría el Push que acaba de ocurrir y saltaría la actualización, dejando los datos sin sincronizar.

## Flujo Completo

### Antes (Fase 2):
```
1. Usuario hace orden en Shopify/WooCommerce
2. Webhook crea movimiento → inventory_movements_queue
3. Worker procesa:
   - Push a Contifico ✓
   - Actualiza cache local ✓
4. Tabla de inventario muestra:
   - Stock Tienda: 101 (actualizado)
   - Stock Contifico: — (sin datos)
   - Última Actualización: Nunca
```

### Ahora (Con Pull Automático):
```
1. Usuario hace orden en Shopify/WooCommerce
2. Webhook crea movimiento → inventory_movements_queue
3. Worker procesa:
   - Push a Contifico ✓
   - Actualiza cache local ✓
   - Pull automático del SKU ✓ (NUEVO)
   - Actualiza sync_logs ✓ (NUEVO)
4. Tabla de inventario muestra:
   - Stock Tienda: 101 (actualizado)
   - Stock Contifico: 101 (actualizado desde Contifico)
   - Última Actualización: 27 nov 2025, 11:50
   - Badge: "Por venta"
```

## Consideraciones

### Performance

**Impacto por Push:**
- 1 llamada extra a Contifico API por cada venta
- ~500ms adicionales en procesamiento
- Aceptable para flujo normal de ventas

**Mitigación:**
- El Pull es selectivo (solo 1 SKU)
- Se ejecuta en background (worker)
- No afecta la experiencia del usuario final

### Locks Granulares (Fase 2)

El Pull automático se beneficia de los locks granulares:
- Push adquiere lock de tipo `'push'`
- Pull automático NO adquiere lock (selectivo es sin lock)
- Si hubiera Pull manual simultáneo, usaría lock de tipo `'pull'`
- No hay bloqueos mutuos

### Manejo de Errores

Si el Pull automático falla:
- ✅ El Push se marca como exitoso (lo importante)
- ⚠️ Log de warning pero no error
- 📊 Los datos se actualizarán en el próximo Pull manual/automático

## Testing

### Caso 1: Venta Normal
1. Crear orden en Shopify con 2 unidades de PT-0002-50ml
2. Verificar logs del worker:
   ```
   [InventoryPush] ✅ Movimiento enviado a Contifico
   [InventoryPush] ✅ Cache actualizado para PT-0002-50ml: -2
   [InventoryPush] Iniciando Pull automático para PT-0002-50ml...
   [Sync] Procesando: PT-0002-50ml
   [Sync] ✅ Actualizado: PT-0002-50ml → 99 unidades
   [InventoryPush] ✅ Pull automático completado para PT-0002-50ml
   ```
3. Verificar en tabla de inventario:
   - Stock Tienda: 99 ✓
   - Stock Contifico: 99 ✓
   - Badge: "Por venta" ✓
   - Fecha actualizada ✓

### Caso 2: Push + Pull Manual Simultáneo
1. Crear orden (trigger Push)
2. Mientras se procesa, ejecutar Pull manual
3. Ambos deben completarse exitosamente
4. No debe haber deadlocks ni conflictos

### Caso 3: API de Contifico Caída
1. Simular fallo de API Contifico
2. Push debe fallar y reintentar ✓
3. Pull automático no debe ejecutarse si Push falla ✓

## Rollback

Si es necesario revertir esta funcionalidad:

```bash
# 1. Editar inventoryPushService.ts
# Comentar o eliminar el bloque de Pull automático (líneas 320-342)

# 2. Opcional: Revertir cambios en SyncService.ts
# El parámetro skipRecentPushCheck puede quedar (no afecta si no se usa)

# 3. Reiniciar servidor
npm run dev
```

## Métricas

### Antes del Pull Automático
- Productos con Push: Stock Contifico = "—" (sin datos)
- Usuario debe hacer Pull manual para ver datos
- Experiencia: Confusa

### Después del Pull Automático
- Productos con Push: Stock Contifico = Valor real
- Datos actualizados automáticamente
- Experiencia: Fluida y profesional

### Costo
- +500ms por venta en procesamiento backend
- +1 llamada API Contifico por venta
- Beneficio: Datos siempre actualizados

## Conclusión

El Pull automático post-Push es la solución óptima para mantener datos reales sin estimaciones. El costo adicional de 1 llamada API por venta es aceptable comparado con el beneficio de mostrar información precisa al usuario.

**Estado:** ✅ Implementado y listo para pruebas
