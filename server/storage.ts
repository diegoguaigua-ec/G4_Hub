import {
  tenants,
  users,
  stores,
  storeProducts,
  syncLogs,
  integrations,
  storeIntegrations,
  syncLogItems,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Proper typing for user creation
interface CreateUserData {
  tenantId?: number;
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
  updateUserLastLogin(id: number): Promise<void>;

  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;

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
        tenantId: insertUser.tenantId!,
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
      .values(insertTenant as any)
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
      .values(insertStore as any)
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
      .values(product as any)
      .onConflictDoUpdate({
        target: [storeProducts.storeId, storeProducts.platformProductId],
        set: product as any,
      })
      .returning();
    return upsertedProduct;
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
    if (items.length === 0) return;

    await db.insert(syncLogItems).values(items);
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
      .orderBy(syncLogs.createdAt)
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
      .values(integration as any)
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
  async getStoreIntegrations(storeId: number): Promise<StoreIntegration[]> {
    return await db
      .select()
      .from(storeIntegrations)
      .where(eq(storeIntegrations.storeId, storeId));
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
      .values(data as any)
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
}

export const storage = new DatabaseStorage();
