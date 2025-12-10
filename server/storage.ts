import {
  tenants,
  users,
  stores,
  storeProducts,
  syncLogs,
  integrations,
  storeIntegrations,
  syncLogItems,
  notifications,
  inventoryMovementsQueue,
  unmappedSkus,
  syncLocks,
  adminActions,
  webhooks,
  type User,
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type Store,
  type InsertStore,
  type StoreProduct,
  type InsertStoreProduct,
  type SyncLog,
  type SyncLogItem,
  type Integration,
  type InsertIntegration,
  type StoreIntegration,
  type InsertStoreIntegration,
  type Notification,
  type InsertNotification,
  type InventoryMovement,
  type InsertInventoryMovement,
  type UnmappedSku,
  type InsertUnmappedSku,
  type SyncLock,
  type InsertSyncLock,
  type Webhook,
  type InsertWebhook,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Proper typing for user creation
interface CreateUserData {
  tenantId: number; // Required - all users must belong to a tenant
  email: string;
  name: string;
  role?: string;
  emailVerified?: boolean;
  passwordHash: string;
}

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: CreateUserData): Promise<User>;
  updateUser(id: number, updates: Partial<{ name: string; email: string }>): Promise<User>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  updateUserRole(id: number, role: string): Promise<void>;
  updateUserLastLogin(id: number): Promise<void>;
  deleteUser(id: number): Promise<void>;

  getAllTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, updates: Partial<{ name: string }>): Promise<Tenant>;
  updateTenantAccountStatus(id: number, accountStatus: string): Promise<Tenant>;
  updateTenantPlan(id: number, planType: string): Promise<Tenant>;
  updateTenantExpiresAt(id: number, expiresAt: Date | null): Promise<Tenant>;
  getTenantOwnerUser(tenantId: number): Promise<User | undefined>;
  deleteTenant(id: number): Promise<void>;
  createAdminAction(action: { adminUserId: number; targetTenantId: number; actionType: string; description: string; metadata?: any }): Promise<void>;

  getStoresByTenant(tenantId: number): Promise<Store[]>;
  getStore(id: number): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, updates: Partial<InsertStore>): Promise<Store>;
  deleteStore(id: number): Promise<void>;

  // Product operations
  getProductsByStore(storeId: number): Promise<StoreProduct[]>;
  upsertProduct(product: InsertStoreProduct): Promise<StoreProduct>;
  deleteProductsByStore(storeId: number): Promise<void>;

  // Sync operations
  createSyncLog(log: Omit<SyncLog, "id" | "createdAt">): Promise<SyncLog>;
  updateSyncLog(
    id: number,
    updates: Partial<Omit<SyncLog, "id" | "createdAt" | "tenantId" | "storeId">>,
  ): Promise<SyncLog>;
  getSyncLogsByStore(storeId: number, limit?: number): Promise<SyncLog[]>;
  updateStoreSyncStatus(
    storeId: number,
    productsCount: number,
    lastSyncAt: Date,
  ): Promise<void>;

  // Integration operations
  getIntegrationsByTenant(tenantId: number): Promise<Integration[]>;
  getIntegration(id: number): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(
    id: number,
    updates: Partial<InsertIntegration>,
  ): Promise<Integration>;
  deleteIntegration(id: number): Promise<void>;

  // Store-Integration relationships
  getStoreIntegrations(storeId: number): Promise<StoreIntegration[]>;
  getIntegrationStores(integrationId: number): Promise<StoreIntegration[]>;
  linkStoreIntegration(data: InsertStoreIntegration): Promise<StoreIntegration>;
  unlinkStoreIntegration(storeId: number, integrationId: number): Promise<void>;
  updateStoreIntegration(
    linkId: number,
    updates: Partial<InsertStoreIntegration>,
  ): Promise<StoreIntegration>;

  // Notification operations
  getNotificationsByTenant(tenantId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationsCount(tenantId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(tenantId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // Inventory movements queue operations
  queueInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;
  getMovementById(id: number): Promise<InventoryMovement | undefined>;
  getPendingMovements(limit?: number): Promise<InventoryMovement[]>;
  getMovementsByStore(storeId: number, limit?: number): Promise<InventoryMovement[]>;
  findDuplicateMovement(
    storeId: number,
    orderId: string,
    sku: string,
    movementType: string,
  ): Promise<InventoryMovement | undefined>;
  updateMovementStatus(
    id: number,
    status: string,
    errorMessage?: string,
  ): Promise<InventoryMovement>;
  incrementMovementAttempts(id: number, nextAttemptAt: Date): Promise<InventoryMovement>;
  resetMovementToPending(id: number, attempts: number, nextAttemptAt: Date, errorMessage: string): Promise<InventoryMovement>;
  markMovementAsProcessed(id: number): Promise<InventoryMovement>;
  deleteOldMovements(beforeDate: Date): Promise<void>;

  // Unmapped SKUs operations
  trackUnmappedSku(data: InsertUnmappedSku): Promise<UnmappedSku>;
  getUnmappedSkusByStore(storeId: number, limit?: number): Promise<UnmappedSku[]>;
  getUnmappedSkusByTenant(tenantId: number, limit?: number): Promise<UnmappedSku[]>;
  markSkuAsResolved(id: number): Promise<UnmappedSku>;
  deleteUnmappedSku(id: number): Promise<void>;

  // Sync lock operations
  acquireLock(storeId: number, lockType: 'pull' | 'push', processId: string, durationMs: number): Promise<SyncLock | null>;
  releaseLock(storeId: number, lockType?: "pull" | "push"): Promise<void>;
  hasActiveLock(storeId: number): Promise<boolean>;
  cleanExpiredLocks(): Promise<void>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "sessions",
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, username));
    return user || undefined;
  }

  async createUser(insertUser: CreateUserData): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        tenantId: insertUser.tenantId,
        email: insertUser.email,
        passwordHash: insertUser.passwordHash,
        name: insertUser.name,
        role: insertUser.role || "admin",
        emailVerified: insertUser.emailVerified || false,
      })
      .returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(tenants.createdAt);
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async getStoresByTenant(tenantId: number): Promise<Store[]> {
    return await db.select().from(stores).where(eq(stores.tenantId, tenantId));
  }

  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db
      .insert(stores)
      .values(insertStore)
      .returning();
    return store;
  }

  async updateStore(id: number, updates: Partial<InsertStore>): Promise<Store> {
    const [store] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return store;
  }

  async deleteStore(id: number): Promise<void> {
    await db.delete(stores).where(eq(stores.id, id));
  }

  // Product operations
  async getProductsByStore(storeId: number): Promise<StoreProduct[]> {
    return await db
      .select()
      .from(storeProducts)
      .where(eq(storeProducts.storeId, storeId));
  }

  async upsertProduct(product: InsertStoreProduct): Promise<StoreProduct> {
    const [upsertedProduct] = await db
      .insert(storeProducts)
      .values(product)
      .onConflictDoUpdate({
        target: [storeProducts.storeId, storeProducts.platformProductId],
        set: {
          sku: product.sku,
          name: product.name,
          price: product.price,
          stockQuantity: product.stockQuantity,
          manageStock: product.manageStock,
          data: product.data,
          lastUpdated: new Date(),
          lastModifiedAt: product.lastModifiedAt || new Date(),
          lastModifiedBy: product.lastModifiedBy || null,
        },
      })
      .returning();
    return upsertedProduct;
  }

  /**
   * Actualiza el stock de un producto de forma optimista (incremento/decremento)
   * Útil para actualizar el cache después de movimientos push sin tener que hacer pull
   */
  async updateProductStockOptimistic(
    storeId: number,
    sku: string,
    delta: number,
    modifiedBy: 'pull' | 'push' | 'manual' = 'push'
  ): Promise<StoreProduct | null> {
    const [updatedProduct] = await db
      .update(storeProducts)
      .set({
        stockQuantity: sql`GREATEST(0, COALESCE(${storeProducts.stockQuantity}, 0) + ${delta})`,
        lastUpdated: new Date(),
        lastModifiedAt: new Date(),
        lastModifiedBy: modifiedBy,
      })
      .where(
        and(
          eq(storeProducts.storeId, storeId),
          eq(storeProducts.sku, sku)
        )
      )
      .returning();

    return updatedProduct || null;
  }

  /**
   * Obtiene un producto por storeId y SKU
   */
  async getProductBySku(storeId: number, sku: string): Promise<StoreProduct | null> {
    const [product] = await db
      .select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, storeId),
          eq(storeProducts.sku, sku)
        )
      )
      .limit(1);

    return product || null;
  }

  async deleteProductsByStore(storeId: number): Promise<void> {
    await db.delete(storeProducts).where(eq(storeProducts.storeId, storeId));
  }

  // Sync operations
  async createSyncLog(
    logData: Omit<SyncLog, "id" | "createdAt">,
  ): Promise<SyncLog> {
    // Validar y truncar campos que tienen límite de caracteres
    const sanitizedData = {
      ...logData,
      // Truncar sync_type a máximo 50 caracteres
      syncType: logData.syncType?.substring(0, 50) || "",
      // Truncar status a máximo 50 caracteres
      status: logData.status?.substring(0, 50) || "",
      // Truncar errorMessage si existe (aunque es TEXT, por seguridad)
      errorMessage: logData.errorMessage?.substring(0, 500) || null,
    };

    const [syncLog] = await db
      .insert(syncLogs)
      .values(sanitizedData)
      .returning();
    return syncLog;
  }

  async updateSyncLog(
    id: number,
    updates: Partial<Omit<SyncLog, "id" | "createdAt" | "tenantId" | "storeId">>,
  ): Promise<SyncLog> {
    // Validar y truncar campos que tienen límite de caracteres
    type SyncLogUpdate = {
      syncType?: string;
      status?: string;
      errorMessage?: string | null;
      syncedCount?: number | null;
      errorCount?: number | null;
      durationMs?: number | null;
      details?: any;
    };

    const sanitizedUpdates: SyncLogUpdate = {};

    if (updates.syncType !== undefined) {
      sanitizedUpdates.syncType = updates.syncType.substring(0, 50);
    }
    if (updates.status !== undefined) {
      sanitizedUpdates.status = updates.status.substring(0, 50);
    }
    if (updates.errorMessage !== undefined) {
      sanitizedUpdates.errorMessage = updates.errorMessage ? updates.errorMessage.substring(0, 500) : null;
    }
    if (updates.syncedCount !== undefined) {
      sanitizedUpdates.syncedCount = updates.syncedCount;
    }
    if (updates.errorCount !== undefined) {
      sanitizedUpdates.errorCount = updates.errorCount;
    }
    if (updates.durationMs !== undefined) {
      sanitizedUpdates.durationMs = updates.durationMs;
    }
    if (updates.details !== undefined) {
      sanitizedUpdates.details = updates.details;
    }

    const [updatedLog] = await db
      .update(syncLogs)
      .set(sanitizedUpdates)
      .where(eq(syncLogs.id, id))
      .returning();

    return updatedLog;
  }

  /*** Crear un registro de producto sincronizado */
  async createSyncLogItem(
    itemData: Omit<SyncLogItem, "id" | "createdAt">,
  ): Promise<SyncLogItem> {
    const [item] = await db.insert(syncLogItems).values(itemData).returning();
    return item;
  }

  /**
   * Crear múltiples registros de productos de una vez (bulk insert)
   */
  async createSyncLogItems(
    items: Omit<SyncLogItem, "id" | "createdAt">[],
  ): Promise<void> {
    if (items.length === 0) {
      console.log('[Storage] ⚠️ createSyncLogItems llamado con array vacío');
      return;
    }

    console.log(`[Storage] 📝 Insertando ${items.length} sync_log_items en la base de datos`);
    console.log(`[Storage] Primera item:`, JSON.stringify(items[0], null, 2));

    try {
      const result = await db.insert(syncLogItems).values(items).returning();
      console.log(`[Storage] ✅ ${result.length} sync_log_items insertados exitosamente`);
      if (result.length > 0) {
        console.log(`[Storage] IDs insertados: ${result.map(r => r.id).join(', ')}`);
      }
    } catch (error: any) {
      console.error(`[Storage] ❌ Error insertando sync_log_items:`, error.message);
      console.error(`[Storage] Items que intentamos insertar:`, JSON.stringify(items, null, 2));
      throw error;
    }
  }

  /**
   * Obtener todos los items (productos) de una sincronización
   */
  async getSyncLogItems(syncLogId: number): Promise<SyncLogItem[]> {
    return await db
      .select()
      .from(syncLogItems)
      .where(eq(syncLogItems.syncLogId, syncLogId))
      .orderBy(desc(syncLogItems.createdAt));
  }

  /**
   * Obtener solo los items con errores de una sincronización
   */
  async getSyncLogItemsWithErrors(syncLogId: number): Promise<SyncLogItem[]> {
    return await db
      .select()
      .from(syncLogItems)
      .where(
        and(
          eq(syncLogItems.syncLogId, syncLogId),
          eq(syncLogItems.status, "failed"),
        ),
      )
      .orderBy(desc(syncLogItems.createdAt));
  }

  /**
   * Obtener items omitidos de una sincronización
   */
  async getSyncLogItemsSkipped(syncLogId: number): Promise<SyncLogItem[]> {
    return await db
      .select()
      .from(syncLogItems)
      .where(
        and(
          eq(syncLogItems.syncLogId, syncLogId),
          eq(syncLogItems.status, "skipped"),
        ),
      )
      .orderBy(desc(syncLogItems.createdAt));
  }

  /**
   * Obtener estadísticas agregadas por categoría de error
   */
  async getSyncLogItemsErrorStats(syncLogId: number): Promise<
    Array<{
      errorCategory: string | null;
      count: number;
    }>
  > {
    const results = await db
      .select({
        errorCategory: syncLogItems.errorCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(syncLogItems)
      .where(
        and(
          eq(syncLogItems.syncLogId, syncLogId),
          eq(syncLogItems.status, "skipped"),
        ),
      )
      .groupBy(syncLogItems.errorCategory);

    return results;
  }

  /**
   * Obtener un sync log con todos sus items incluidos
   */
  async getSyncLogWithItems(syncLogId: number): Promise<{
    syncLog: SyncLog | null;
    items: SyncLogItem[];
  }> {
    const syncLog = await this.getSyncLog(syncLogId);

    if (!syncLog) {
      return { syncLog: null, items: [] };
    }

    const items = await this.getSyncLogItems(syncLogId);

    return { syncLog, items };
  }

  /**
   * Obtener el último sync_log_item de cada SKU para una tienda
   * Esto asegura que siempre mostremos la información más reciente de cada producto,
   * sin importar de qué sync_log provenga
   */
  async getLatestSyncItemPerSku(storeId: number): Promise<SyncLogItem[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (sli.sku)
        sli.id,
        sli.sync_log_id as "syncLogId",
        sli.sku,
        sli.product_id as "productId",
        sli.product_name as "productName",
        sli.status,
        sli.stock_before as "stockBefore",
        sli.stock_after as "stockAfter",
        sli.error_category as "errorCategory",
        sli.error_message as "errorMessage",
        sli.created_at as "createdAt"
      FROM sync_log_items sli
      INNER JOIN sync_logs sl ON sli.sync_log_id = sl.id
      WHERE sl.store_id = ${storeId}
        AND sli.sku IS NOT NULL
      ORDER BY sli.sku, sli.created_at DESC
    `);

    // Convert PostgreSQL timestamp strings to Date objects to match Drizzle's behavior
    return result.rows.map((row: any) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
    })) as SyncLogItem[];
  }

  /**
   * Obtener un sync log por ID (método helper si no existe)
   */
  async getSyncLog(id: number): Promise<SyncLog | null> {
    const [log] = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.id, id))
      .limit(1);

    return log || null;
  }

  /**
   * Obtener todos los sync logs de un tenant con paginación
   */
  async getSyncLogs(
    tenantId: number,
    options: {
      storeId?: number;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ logs: SyncLog[]; total: number }> {
    const { storeId, status, limit = 20, offset = 0 } = options;

    // Construir condiciones
    const conditions = [eq(syncLogs.tenantId, tenantId)];

    if (storeId) {
      conditions.push(eq(syncLogs.storeId, storeId));
    }

    if (status) {
      conditions.push(eq(syncLogs.status, status));
    }

    // Obtener logs
    const logs = await db
      .select()
      .from(syncLogs)
      .where(and(...conditions))
      .orderBy(desc(syncLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Contar total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncLogs)
      .where(and(...conditions));

    return {
      logs,
      total: countResult?.count || 0,
    };
  }

  async getSyncLogsByStore(
    storeId: number,
    limit: number = 50,
  ): Promise<SyncLog[]> {
    return await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.storeId, storeId))
      .orderBy(desc(syncLogs.createdAt))  // Order by most recent first
      .limit(limit);
  }

  async getSyncLogsByStoreAndType(
    storeId: number,
    syncType: string,
    limit: number = 50,
  ): Promise<SyncLog[]> {
    return await db
      .select()
      .from(syncLogs)
      .where(and(eq(syncLogs.storeId, storeId), eq(syncLogs.syncType, syncType)))
      .orderBy(desc(syncLogs.createdAt))  // Order by most recent first
      .limit(limit);
  }

  /**
   * Get latest pull-type sync logs for a store (includes both 'pull' and 'pull_selective')
   * Useful for getting the most recent inventory sync regardless of whether it was full or selective
   */
  async getLatestPullSyncLogs(
    storeId: number,
    limit: number = 1,
  ): Promise<SyncLog[]> {
    return await db
      .select()
      .from(syncLogs)
      .where(
        and(
          eq(syncLogs.storeId, storeId),
          or(
            eq(syncLogs.syncType, 'pull'),
            eq(syncLogs.syncType, 'pull_selective')
          )
        )
      )
      .orderBy(desc(syncLogs.createdAt))  // Order by most recent first
      .limit(limit);
  }

  async updateStoreSyncStatus(
    storeId: number,
    productsCount: number,
    lastSyncAt: Date,
  ): Promise<void> {
    await db
      .update(stores)
      .set({
        productsCount,
        lastSyncAt,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, storeId));
  }

  // Integration operations
  async getIntegrationsByTenant(tenantId: number): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId))
      .orderBy(integrations.createdAt);
  }

  async getIntegration(id: number): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id));
    return integration || undefined;
  }

  async createIntegration(
    integration: InsertIntegration,
  ): Promise<Integration> {
    const [created] = await db
      .insert(integrations)
      .values(integration)
      .returning();
    return created;
  }

  async updateIntegration(
    id: number,
    updates: Partial<InsertIntegration>,
  ): Promise<Integration> {
    const [updated] = await db
      .update(integrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return updated;
  }

  async deleteIntegration(id: number): Promise<void> {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  // Store-Integration relationships
  async getStoreIntegrations(storeId: number): Promise<(StoreIntegration & { integration: Integration | null })[]> {
    const results = await db
      .select()
      .from(storeIntegrations)
      .leftJoin(integrations, eq(storeIntegrations.integrationId, integrations.id))
      .where(eq(storeIntegrations.storeId, storeId));

    // Mapear resultados al formato esperado
    return results.map(row => ({
      ...row.store_integrations,
      integration: row.integrations
    }));
  }

  async getIntegrationStores(
    integrationId: number,
  ): Promise<StoreIntegration[]> {
    return await db
      .select()
      .from(storeIntegrations)
      .where(eq(storeIntegrations.integrationId, integrationId));
  }

  async linkStoreIntegration(
    data: InsertStoreIntegration,
  ): Promise<StoreIntegration> {
    const [link] = await db
      .insert(storeIntegrations)
      .values(data)
      .returning();
    return link;
  }

  async unlinkStoreIntegration(
    storeId: number,
    integrationId: number,
  ): Promise<void> {
    await db
      .delete(storeIntegrations)
      .where(
        and(
          eq(storeIntegrations.storeId, storeId),
          eq(storeIntegrations.integrationId, integrationId),
        ),
      );
  }

  async updateStoreIntegration(
    linkId: number,
    updates: Partial<InsertStoreIntegration>,
  ): Promise<StoreIntegration> {
    const [updated] = await db
      .update(storeIntegrations)
      .set(updates)
      .where(eq(storeIntegrations.id, linkId))
      .returning();
    return updated;
  }

  // Notification operations
  async getNotificationsByTenant(
    tenantId: number,
    limit: number = 50,
  ): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.tenantId, tenantId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationsCount(tenantId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.read, false),
        ),
      );
    return result?.count || 0;
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(tenantId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.read, false),
        ),
      );
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // User management operations
  async updateUser(
    id: number,
    updates: Partial<{ name: string; email: string }>,
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateUserRole(id: number, role: string): Promise<void> {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Tenant management operations
  async updateTenant(
    id: number,
    updates: Partial<{ name: string }>,
  ): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async updateTenantAccountStatus(id: number, accountStatus: string): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ accountStatus, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async updateTenantPlan(id: number, planType: string): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ planType, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async updateTenantExpiresAt(id: number, expiresAt: Date | null): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ expiresAt, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async getTenantOwnerUser(tenantId: number): Promise<User | undefined> {
    const allUsers = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.createdAt);
    return allUsers[0];
  }

  async deleteTenant(id: number): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async createAdminAction(action: { adminUserId: number; targetTenantId: number; actionType: string; description: string; metadata?: any }): Promise<void> {
    await db.insert(adminActions).values(action);
  }

  // Webhooks operations
  async registerWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(webhook).returning();
    return created;
  }

  async getWebhooksByStore(storeId: number): Promise<Webhook[]> {
    return await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.storeId, storeId),
          eq(webhooks.status, "active")
        )
      );
  }

  async getWebhookByPlatformId(platform: string, platformWebhookId: string): Promise<Webhook | undefined> {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.platform, platform),
          eq(webhooks.platformWebhookId, platformWebhookId)
        )
      )
      .limit(1);
    return webhook;
  }

  async markWebhookAsDeleted(id: number): Promise<void> {
    await db
      .update(webhooks)
      .set({
        status: "deleted",
        deletedAt: new Date()
      })
      .where(eq(webhooks.id, id));
  }

  async deleteWebhooksByStore(storeId: number): Promise<void> {
    await db
      .update(webhooks)
      .set({
        status: "deleted",
        deletedAt: new Date()
      })
      .where(eq(webhooks.storeId, storeId));
  }

  // Inventory movements queue operations
  async queueInventoryMovement(
    movement: InsertInventoryMovement,
  ): Promise<InventoryMovement> {
    const [queued] = await db
      .insert(inventoryMovementsQueue)
      .values(movement)
      .returning();
    return queued;
  }

  async getMovementById(id: number): Promise<InventoryMovement | undefined> {
    const [movement] = await db
      .select()
      .from(inventoryMovementsQueue)
      .where(eq(inventoryMovementsQueue.id, id))
      .limit(1);
    return movement;
  }

  async getPendingMovements(limit: number = 50): Promise<InventoryMovement[]> {
    return await db
      .select()
      .from(inventoryMovementsQueue)
      .where(
        and(
          or(
            eq(inventoryMovementsQueue.status, "pending"),
            eq(inventoryMovementsQueue.status, "processing"),
          ),
          sql`${inventoryMovementsQueue.nextAttemptAt} IS NULL OR ${inventoryMovementsQueue.nextAttemptAt} <= NOW()`,
          // CRÍTICO: Solo procesar movimientos que NO han alcanzado el máximo de intentos
          sql`${inventoryMovementsQueue.attempts} < ${inventoryMovementsQueue.maxAttempts}`,
        ),
      )
      .orderBy(inventoryMovementsQueue.createdAt)
      .limit(limit);
  }

  async getMovementsByStore(
    storeId: number,
    limit: number = 100,
  ): Promise<InventoryMovement[]> {
    return await db
      .select()
      .from(inventoryMovementsQueue)
      .where(eq(inventoryMovementsQueue.storeId, storeId))
      .orderBy(desc(inventoryMovementsQueue.createdAt))
      .limit(limit);
  }

  async findDuplicateMovement(
    storeId: number,
    orderId: string,
    sku: string,
    movementType: string,
  ): Promise<InventoryMovement | undefined> {
    const [movement] = await db
      .select()
      .from(inventoryMovementsQueue)
      .where(
        and(
          eq(inventoryMovementsQueue.storeId, storeId),
          eq(inventoryMovementsQueue.orderId, orderId),
          eq(inventoryMovementsQueue.sku, sku),
          eq(inventoryMovementsQueue.movementType, movementType),
        ),
      )
      .limit(1);
    return movement;
  }

  async updateMovementStatus(
    id: number,
    status: string,
    errorMessage?: string,
  ): Promise<InventoryMovement> {
    const [updated] = await db
      .update(inventoryMovementsQueue)
      .set({
        status,
        errorMessage: errorMessage || null,
        lastAttemptAt: new Date(),
      })
      .where(eq(inventoryMovementsQueue.id, id))
      .returning();
    return updated;
  }

  async incrementMovementAttempts(
    id: number,
    nextAttemptAt: Date,
  ): Promise<InventoryMovement> {
    const [updated] = await db
      .update(inventoryMovementsQueue)
      .set({
        attempts: sql`${inventoryMovementsQueue.attempts} + 1`,
        lastAttemptAt: new Date(),
        nextAttemptAt,
      })
      .where(eq(inventoryMovementsQueue.id, id))
      .returning();
    return updated;
  }

  async resetMovementToPending(
    id: number,
    attempts: number,
    nextAttemptAt: Date,
    errorMessage: string,
  ): Promise<InventoryMovement> {
    const [updated] = await db
      .update(inventoryMovementsQueue)
      .set({
        status: "pending",
        attempts,
        lastAttemptAt: new Date(),
        nextAttemptAt,
        errorMessage,
      })
      .where(eq(inventoryMovementsQueue.id, id))
      .returning();
    return updated;
  }

  async markMovementAsProcessed(id: number): Promise<InventoryMovement> {
    const [updated] = await db
      .update(inventoryMovementsQueue)
      .set({
        status: "completed",
        processedAt: new Date(),
      })
      .where(eq(inventoryMovementsQueue.id, id))
      .returning();
    return updated;
  }

  async deleteOldMovements(beforeDate: Date): Promise<void> {
    await db
      .delete(inventoryMovementsQueue)
      .where(
        and(
          sql`${inventoryMovementsQueue.createdAt} < ${beforeDate}`,
          sql`${inventoryMovementsQueue.status} IN ('completed', 'failed')`,
        ),
      );
  }

  // Unmapped SKUs operations
  async trackUnmappedSku(data: InsertUnmappedSku): Promise<UnmappedSku> {
    // Try to upsert - if SKU already exists for this store, increment occurrences
    const existing = await db
      .select()
      .from(unmappedSkus)
      .where(
        and(
          eq(unmappedSkus.storeId, data.storeId),
          eq(unmappedSkus.sku, data.sku),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(unmappedSkus)
        .set({
          occurrences: sql`${unmappedSkus.occurrences} + 1`,
          lastSeenAt: new Date(),
          productName: data.productName || existing[0].productName,
        })
        .where(eq(unmappedSkus.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(unmappedSkus)
        .values(data)
        .returning();
      return created;
    }
  }

  async getUnmappedSkusByStore(
    storeId: number,
    limit: number = 100,
  ): Promise<UnmappedSku[]> {
    return await db
      .select()
      .from(unmappedSkus)
      .where(
        and(
          eq(unmappedSkus.storeId, storeId),
          eq(unmappedSkus.resolved, false),
        ),
      )
      .orderBy(desc(unmappedSkus.lastSeenAt))
      .limit(limit);
  }

  async getUnmappedSkusByTenant(
    tenantId: number,
    limit: number = 100,
  ): Promise<UnmappedSku[]> {
    return await db
      .select()
      .from(unmappedSkus)
      .where(
        and(
          eq(unmappedSkus.tenantId, tenantId),
          eq(unmappedSkus.resolved, false),
        ),
      )
      .orderBy(desc(unmappedSkus.lastSeenAt))
      .limit(limit);
  }

  async markSkuAsResolved(id: number): Promise<UnmappedSku> {
    const [updated] = await db
      .update(unmappedSkus)
      .set({ resolved: true })
      .where(eq(unmappedSkus.id, id))
      .returning();
    return updated;
  }

  async deleteUnmappedSku(id: number): Promise<void> {
    await db.delete(unmappedSkus).where(eq(unmappedSkus.id, id));
  }

  // Sync lock operations
  async acquireLock(
    storeId: number,
    lockType: "pull" | "push",
    processId: string,
    durationMs: number,
  ): Promise<SyncLock | null> {
    try {
      // First, clean expired locks
      await this.cleanExpiredLocks();

      // Try to insert a new lock
      const expiresAt = new Date(Date.now() + durationMs);
      const [lock] = await db
        .insert(syncLocks)
        .values({
          storeId,
          lockType,
          processId,
          expiresAt,
        })
        .returning();
      return lock;
    } catch (error: any) {
      // If lock already exists (unique constraint violation), return null
      if (error.code === "23505") {
        return null;
      }
      throw error;
    }
  }

  async releaseLock(storeId: number, lockType?: "pull" | "push"): Promise<void> {
    if (lockType) {
      // Release specific lock type
      await db
        .delete(syncLocks)
        .where(
          and(
            eq(syncLocks.storeId, storeId),
            eq(syncLocks.lockType, lockType)
          )
        );
    } else {
      // Release all locks for backward compatibility
      await db.delete(syncLocks).where(eq(syncLocks.storeId, storeId));
    }
  }

  async hasActiveLock(storeId: number, lockType?: "pull" | "push"): Promise<boolean> {
    await this.cleanExpiredLocks();
    const conditions = lockType
      ? and(eq(syncLocks.storeId, storeId), eq(syncLocks.lockType, lockType))
      : eq(syncLocks.storeId, storeId);

    const locks = await db
      .select()
      .from(syncLocks)
      .where(conditions)
      .limit(1);
    return locks.length > 0;
  }

  async hasRecentPushMovements(
    storeId: number,
    sku: string,
    withinMinutes: number = 5
  ): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
    const recentMovements = await db
      .select()
      .from(inventoryMovementsQueue)
      .where(
        and(
          eq(inventoryMovementsQueue.storeId, storeId),
          eq(inventoryMovementsQueue.sku, sku),
          eq(inventoryMovementsQueue.status, "completed"),
          sql`${inventoryMovementsQueue.processedAt} > ${cutoffTime}`
        )
      )
      .limit(1);

    return recentMovements.length > 0;
  }

  async cleanExpiredLocks(): Promise<void> {
    await db
      .delete(syncLocks)
      .where(sql`${syncLocks.expiresAt} < NOW()`);
  }
}

export const storage = new DatabaseStorage();
