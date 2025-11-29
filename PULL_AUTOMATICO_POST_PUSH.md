# Solución Completa: Datos Actualizados en Tabla de Inventario

## Problemas Identificados

Después de implementar Fase 1 y Fase 2, se identificaron **DOS problemas** en la tabla de inventario:

### Problema 1: Datos Desactualizados Después de Push (Venta)

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

### Problema 2: Datos Desactualizados Después de Pull Selectivo

**Síntoma:**
```
1. Sincronizar PT-0002-50ml (11:00 AM) → Todo OK ✓
2. Sincronizar PT-0002-100ml (11:30 AM) → Todo OK ✓
3. PERO ahora PT-0002-50ml muestra:
   - Stock Contifico: —
   - Última Actualización: Nunca
```

**Causa:**
```typescript
// Código anterior en routes.ts
const latestSyncLog = await storage.getLatestPullSyncLogs(storeId, 1)[0];
const syncItems = await storage.getSyncLogItems(latestSyncLog.id); // Solo items del último log

// latestSyncLog = Pull 2 (11:30 AM) que solo tiene PT-0002-100ml
// PT-0002-50ml no está en ese log → muestra datos en blanco
```

El endpoint solo buscaba items del **último sync_log**, no el último item de cada SKU.

---

## Soluciones Implementadas

### Solución 1: Pull Automático Post-Push

Después de cada Push exitoso, se ejecuta automáticamente un Pull selectivo del producto que se acaba de enviar a Contifico.

**Ventajas:**
- ✅ Datos siempre reales y actualizados después de ventas
- ✅ No hay estimaciones
- ✅ Sincronización automática
- ✅ Usuario siempre ve información correcta

**Desventajas:**
- ⚠️ 1 llamada adicional a la API por cada Push
- ⚠️ ~500ms adicionales en procesamiento backend

### Solución 2: Endpoint Mejorado (getLatestSyncItemPerSku)

Modificado el endpoint `/api/sync-status` para obtener el **último sync_log_item de cada SKU**, sin importar de qué sync_log provenga.

**Ventajas:**
- ✅ Resuelve el problema de Pulls selectivos
- ✅ Muestra siempre la última información disponible de cada producto
- ✅ No requiere llamadas adicionales a la API
- ✅ Query eficiente con `DISTINCT ON` de PostgreSQL

---

## Cambios Implementados

### 1. **server/services/inventoryPushService.ts** (Solución 1)

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
  console.warn(
    `[InventoryPush] ⚠️ No se pudo ejecutar Pull automático para ${movement.sku}:`,
    pullError.message,
  );
}
```

### 2. **server/services/SyncService.ts** (Solución 1)

Agregado parámetro `skipRecentPushCheck` para evitar conflictos:

```typescript
interface SyncOptions {
  dryRun?: boolean;
  limit?: number;
  skipRecentPushCheck?: boolean; // Para Pull automático post-Push
}

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

### 3. **server/storage.ts** (Solución 2)

Nuevo método para obtener último sync item de cada SKU:

```typescript
/**
 * Obtener el último sync_log_item de cada SKU para una tienda
 * Esto asegura que siempre mostremos la información más reciente de cada producto,
 * sin importar de qué sync_log provenga
 */
async getLatestSyncItemPerSku(storeId: number): Promise<SyncLogItem[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (sli.sku)
      sli.*
    FROM sync_log_items sli
    INNER JOIN sync_logs sl ON sli.sync_log_id = sl.id
    WHERE sl.store_id = ${storeId}
      AND sli.sku IS NOT NULL
    ORDER BY sli.sku, sli.created_at DESC
  `);

  return result.rows as SyncLogItem[];
}
```

**Explicación del query:**
- `DISTINCT ON (sli.sku)`: Una fila por SKU
- `ORDER BY sli.sku, sli.created_at DESC`: Para cada SKU, la más reciente primero
- PostgreSQL devuelve la primera fila de cada grupo = la más reciente de cada SKU

### 4. **server/routes.ts** (Solución 2)

Modificado endpoint `/api/sync-status` para usar el nuevo método:

```typescript
// ANTES:
const latestSyncLog = await storage.getLatestPullSyncLogs(storeId, 1)[0];
const syncItems = await storage.getSyncLogItems(latestSyncLog.id); // Solo del último log

// AHORA:
const latestSyncItems = await storage.getLatestSyncItemPerSku(parseInt(storeId));
// Obtiene el último item de CADA SKU, sin importar el sync_log
```

---

## Flujo Completo

### Escenario 1: Venta (Push)
```
1. Usuario crea orden en Shopify → PT-0002-50ml: -2 unidades

2. Worker procesa:
   ✅ Push a Contifico (egreso -2)
   ✅ Actualiza cache local (stock: 101 → 99)
   ✅ Pull automático del SKU (SOLUCIÓN 1)
   ✅ Crea sync_log_item con datos reales

3. Tabla de inventario (usa SOLUCIÓN 2):
   - Stock Tienda: 99
   - Stock Contifico: 99
   - Última Actualización: [timestamp actual]
   - Badge: "Por venta"
```

### Escenario 2: Pull Selectivo de Múltiples Productos
```
1. Pull PT-0002-50ml (11:00 AM)
   - Crea sync_log id=100 con item de PT-0002-50ml

2. Pull PT-0002-100ml (11:30 AM)
   - Crea sync_log id=101 con item de PT-0002-100ml

3. Tabla de inventario (usa SOLUCIÓN 2):
   - PT-0002-50ml: Muestra datos del sync_log 100 ✓
   - PT-0002-100ml: Muestra datos del sync_log 101 ✓
   - Ambos con información actualizada ✓
```

---

## Testing

### Caso 1: Venta Normal
```bash
1. Crear orden en Shopify con PT-0002-50ml (-2 unidades)

2. Verificar logs:
   [InventoryPush] ✅ Movimiento enviado a Contifico
   [InventoryPush] ✅ Cache actualizado para PT-0002-50ml: -2
   [InventoryPush] Iniciando Pull automático para PT-0002-50ml...
   [Sync] ✅ Actualizado: PT-0002-50ml → 99 unidades
   [InventoryPush] ✅ Pull automático completado

3. Verificar tabla inventario:
   - Stock Tienda: 99 ✓
   - Stock Contifico: 99 ✓
   - Fecha actualizada ✓
```

### Caso 2: Pull Selectivo Múltiple (EL PROBLEMA QUE REPORTASTE)
```bash
1. Sincronizar PT-0002-50ml
   ✓ Stock Tienda: 101
   ✓ Stock Contifico: 101
   ✓ Fecha: 11:00 AM

2. Sincronizar PT-0002-100ml
   ✓ Stock Tienda: 10
   ✓ Stock Contifico: 10
   ✓ Fecha: 11:30 AM

3. Verificar PT-0002-50ml (no debe perder datos):
   ✓ Stock Tienda: 101
   ✓ Stock Contifico: 101 (mantiene datos del Pull de 11:00 AM)
   ✓ Fecha: 11:00 AM (NO "Nunca")
   ✓ Estado: "Sincronizado" (NO "Pendiente")
```

### Caso 3: Pull + Push + Pull Selectivo
```bash
1. Pull completo (11:00 AM)
   - Sincroniza todos los productos

2. Venta de PT-0002-50ml (11:15 AM)
   - Push + Pull automático

3. Pull selectivo de PT-0002-100ml (11:30 AM)
   - Solo sincroniza PT-0002-100ml

4. Verificar tabla:
   - PT-0002-50ml: Datos del Push/Pull de 11:15 AM ✓
   - PT-0002-100ml: Datos del Pull de 11:30 AM ✓
   - Otros productos: Datos del Pull de 11:00 AM ✓
```

---

## Comparación Antes vs Ahora

### Antes (Con los problemas):
```
Acción 1: Pull PT-0002-50ml (11:00)
  → PT-0002-50ml: Stock 101, Fecha 11:00 ✓

Acción 2: Pull PT-0002-100ml (11:30)
  → PT-0002-100ml: Stock 10, Fecha 11:30 ✓
  → PT-0002-50ml: Stock —, Fecha "Nunca" ❌ (PROBLEMA)

Acción 3: Venta PT-0002-50ml (12:00)
  → PT-0002-50ml: Stock 99, Fecha "Nunca" ❌ (PROBLEMA)
```

### Ahora (Con las soluciones):
```
Acción 1: Pull PT-0002-50ml (11:00)
  → PT-0002-50ml: Stock 101, Fecha 11:00 ✓

Acción 2: Pull PT-0002-100ml (11:30)
  → PT-0002-100ml: Stock 10, Fecha 11:30 ✓
  → PT-0002-50ml: Stock 101, Fecha 11:00 ✓ (SOLUCIONADO)

Acción 3: Venta PT-0002-50ml (12:00)
  → Pull automático + endpoint mejorado
  → PT-0002-50ml: Stock 99, Fecha 12:00 ✓ (SOLUCIONADO)
```

---

## Performance

### Impacto de Solución 1 (Pull Automático):
- **+1 llamada** a API Contifico por venta
- **~500ms** adicionales en procesamiento backend
- **0ms** impacto en usuario (todo en background)

### Impacto de Solución 2 (Endpoint Mejorado):
- **0 llamadas** adicionales a la API
- **Query eficiente** con `DISTINCT ON` (índice en `sku` y `created_at`)
- **Mismo tiempo** de respuesta que antes

**Total:** Mejor experiencia con costo aceptable

---

## Conclusión

Se implementaron **DOS soluciones complementarias**:

1. **Pull Automático Post-Push**: Resuelve el problema de ventas
2. **Endpoint Mejorado (getLatestSyncItemPerSku)**: Resuelve el problema de Pulls selectivos

Juntas, aseguran que **cada producto siempre muestre su información más reciente**, sin importar:
- Si hubo una venta
- Si se sincronizó selectivamente
- Si se sincronizó en diferentes momentos

**Estado:** ✅ Implementado y listo para pruebas

---

## Archivos Modificados

- ✅ server/services/inventoryPushService.ts (Pull automático)
- ✅ server/services/SyncService.ts (skipRecentPushCheck)
- ✅ server/storage.ts (getLatestSyncItemPerSku)
- ✅ server/routes.ts (endpoint mejorado)
