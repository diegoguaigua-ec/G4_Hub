import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  decimal,
  unique,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Tenants table
export const tenants = pgTable("tenants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  subdomain: varchar("subdomain", { length: 100 }).notNull().unique(),
  planType: varchar("plan_type", { length: 50 }).default("starter"),
  status: varchar("status", { length: 20 }).default("active"),
  settings: jsonb("settings").default({}),
  apiKey: varchar("api_key", { length: 255 }).notNull().unique(),
  // Contífico environment configuration
  contificoTestApiKey: varchar("contifico_test_api_key", { length: 500 }),
  contificoProdApiKey: varchar("contifico_prod_api_key", { length: 500 }),
  contificoEnvironment: varchar("contifico_environment", {
    length: 20,
  }).default("test"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, {
    onDelete: "cascade",
  }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("admin"),
  emailVerified: boolean("email_verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores table
export const stores = pgTable("stores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  storeUrl: varchar("store_url", { length: 500 }).notNull(),
  apiCredentials: jsonb("api_credentials").notNull(),
  syncConfig: jsonb("sync_config").default({}),
  status: varchar("status", { length: 20 }).default("active"),
  // Connection tracking fields
  connectionStatus: varchar("connection_status", { length: 20 })
    .notNull()
    .default("untested"),
  lastConnectionTest: timestamp("last_connection_test"),
  storeInfo: jsonb("store_info").notNull().default({}),
  productsCount: integer("products_count").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store products cache table
export const storeProducts = pgTable(
  "store_products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    storeId: integer("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    platformProductId: varchar("platform_product_id", {
      length: 100,
    }).notNull(),
    sku: varchar("sku", { length: 100 }),
    name: varchar("name", { length: 255 }),
    price: integer("price"),
    stockQuantity: integer("stock_quantity"),
    manageStock: boolean("manage_stock").notNull().default(false),
    data: jsonb("data"),
    lastUpdated: timestamp("last_updated").defaultNow(),
  },
  (table) => [
    index("idx_store_products_store_platform").on(
      table.storeId,
      table.platformProductId,
    ),
    unique("uq_store_products_store_platform").on(
      table.storeId,
      table.platformProductId,
    ),
  ],
);

// Sync logs table
export const syncLogs = pgTable("sync_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(),
  storeId: integer("store_id").references(() => stores.id, {
    onDelete: "cascade",
  }),
  syncType: varchar("sync_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  syncedCount: integer("synced_count").default(0),
  errorCount: integer("error_count").default(0),
  durationMs: integer("duration_ms"),
  details: jsonb("details").default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sync Log Items - Detalle de productos por sincronización
export const syncLogItems = pgTable("sync_log_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  syncLogId: integer("sync_log_id")
    .notNull()
    .references(() => syncLogs.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 255 }).notNull(),
  productId: varchar("product_id", { length: 255 }), // ID en la tienda (Shopify/WooCommerce)
  productName: varchar("product_name", { length: 500 }),
  status: varchar("status", { length: 20 }).notNull(), // 'success', 'failed', 'skipped'
  stockBefore: integer("stock_before"),
  stockAfter: integer("stock_after"),
  errorCategory: varchar("error_category", { length: 50 }), // 'not_found_contifico', 'not_found_store', 'api_error', etc.
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tipo TypeScript para sync_log_items
export type SyncLogItem = typeof syncLogItems.$inferSelect;
export type InsertSyncLogItem = typeof syncLogItems.$inferInsert;

// Schema de inserción con Zod
export const insertSyncLogItemSchema = createInsertSchema(syncLogItems);

// Integraciones
export const integrations = pgTable(
  "integrations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    integrationType: varchar("integration_type", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    settings: jsonb("settings").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_integrations_tenant").on(table.tenantId),
    index("idx_integrations_type").on(table.integrationType),
  ],
);

// Relación tiendas <-> integraciones
export const storeIntegrations = pgTable(
  "store_integrations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: integer("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    syncConfig: jsonb("sync_config").default({}),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_store_integrations_store").on(table.storeId),
    index("idx_store_integrations_integration").on(table.integrationId),
    unique("uq_store_integration").on(table.storeId, table.integrationId),
  ],
);

// Notifications table
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    storeId: integer("store_id").references(() => stores.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 50 }).notNull(), // 'sync_success', 'sync_failure', 'info', etc.
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("info"), // 'info', 'success', 'warning', 'error'
    read: boolean("read").notNull().default(false),
    data: jsonb("data").default({}), // Additional data like syncLogId, productCount, etc.
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_notifications_tenant").on(table.tenantId),
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_store").on(table.storeId),
    index("idx_notifications_read").on(table.read),
    index("idx_notifications_created").on(table.createdAt),
  ],
);

// Inventory Movements Queue - for push inventory (stores → Contífico)
export const inventoryMovementsQueue = pgTable(
  "inventory_movements_queue",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    storeId: integer("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    integrationId: integer("integration_id")
      .references(() => integrations.id, { onDelete: "cascade" })
      .notNull(),
    movementType: varchar("movement_type", { length: 20 }).notNull(), // 'egreso' | 'ingreso'
    sku: varchar("sku", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    orderId: varchar("order_id", { length: 255 }), // Store order ID for reference
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'order_paid', 'order_cancelled', etc.
    status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextAttemptAt: timestamp("next_attempt_at"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").default({}), // Store webhook payload, line items, etc.
    createdAt: timestamp("created_at").defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    index("idx_inventory_movements_tenant").on(table.tenantId),
    index("idx_inventory_movements_store").on(table.storeId),
    index("idx_inventory_movements_status").on(table.status),
    index("idx_inventory_movements_next_attempt").on(table.nextAttemptAt),
    index("idx_inventory_movements_created").on(table.createdAt),
  ],
);

// Unmapped SKUs - products that exist in stores but not in Contífico
export const unmappedSkus = pgTable(
  "unmapped_skus",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    storeId: integer("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    sku: varchar("sku", { length: 255 }).notNull(),
    productName: varchar("product_name", { length: 500 }),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    occurrences: integer("occurrences").notNull().default(1),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_unmapped_skus_tenant").on(table.tenantId),
    index("idx_unmapped_skus_store").on(table.storeId),
    index("idx_unmapped_skus_resolved").on(table.resolved),
    unique("uq_unmapped_skus_store_sku").on(table.storeId, table.sku),
  ],
);

// Sync Locks - prevent concurrent sync operations
export const syncLocks = pgTable(
  "sync_locks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    storeId: integer("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    lockType: varchar("lock_type", { length: 20 }).notNull(), // 'pull', 'push'
    lockedAt: timestamp("locked_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    processId: varchar("process_id", { length: 100 }), // For debugging which process holds the lock
  },
  (table) => [
    index("idx_sync_locks_store").on(table.storeId),
    index("idx_sync_locks_expires").on(table.expiresAt),
  ],
);

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  stores: many(stores),
  syncLogs: many(syncLogs),
  integrations: many(integrations),
  notifications: many(notifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  notifications: many(notifications),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stores.tenantId],
    references: [tenants.id],
  }),
  syncLogs: many(syncLogs),
  products: many(storeProducts),
  storeIntegrations: many(storeIntegrations),
  notifications: many(notifications),
}));

export const storeProductsRelations = relations(storeProducts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [storeProducts.tenantId],
    references: [tenants.id],
  }),
  store: one(stores, {
    fields: [storeProducts.storeId],
    references: [stores.id],
  }),
}));

export const syncLogItemsRelations = relations(syncLogItems, ({ one }) => ({
  syncLog: one(syncLogs, {
    fields: [syncLogItems.syncLogId],
    references: [syncLogs.id],
  }),
}));

export const syncLogsRelations = relations(syncLogs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [syncLogs.tenantId],
    references: [tenants.id],
  }),
  store: one(stores, {
    fields: [syncLogs.storeId],
    references: [stores.id],
  }),
   items: many(syncLogItems),
}));

export const integrationsRelations = relations(
  integrations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [integrations.tenantId],
      references: [tenants.id],
    }),
    storeIntegrations: many(storeIntegrations),
  }),
);

export const storeIntegrationsRelations = relations(
  storeIntegrations,
  ({ one }) => ({
    store: one(stores, {
      fields: [storeIntegrations.storeId],
      references: [stores.id],
    }),
    integration: one(integrations, {
      fields: [storeIntegrations.integrationId],
      references: [integrations.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const inventoryMovementsQueueRelations = relations(
  inventoryMovementsQueue,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [inventoryMovementsQueue.tenantId],
      references: [tenants.id],
    }),
    store: one(stores, {
      fields: [inventoryMovementsQueue.storeId],
      references: [stores.id],
    }),
    integration: one(integrations, {
      fields: [inventoryMovementsQueue.integrationId],
      references: [integrations.id],
    }),
  }),
);

export const unmappedSkusRelations = relations(unmappedSkus, ({ one }) => ({
  tenant: one(tenants, {
    fields: [unmappedSkus.tenantId],
    references: [tenants.id],
  }),
  store: one(stores, {
    fields: [unmappedSkus.storeId],
    references: [stores.id],
  }),
}));

export const syncLocksRelations = relations(syncLocks, ({ one }) => ({
  store: one(stores, {
    fields: [syncLocks.storeId],
    references: [stores.id],
  }),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
  lastLoginAt: () => z.date().optional(),
})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastLoginAt: true,
    passwordHash: true,
  })
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

export const insertStoreSchema = createInsertSchema(stores, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
  lastSyncAt: () => z.date().optional(),
  lastConnectionTest: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
  lastConnectionTest: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreIntegrationSchema = createInsertSchema(
  storeIntegrations,
  {
    createdAt: () => z.date().optional(),
  },
).omit({
  id: true,
  createdAt: true,
});

// Enhanced store validation schemas
export const createStoreSchema = z
  .object({
    storeName: z
      .string()
      .min(1, "Store name is required")
      .max(255, "Store name too long"),
    storeUrl: z
      .string()
      .url("Must be a valid URL")
      .refine((url) => {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") return false;

          const hostname = parsed.hostname.toLowerCase();
          if (hostname === "localhost" || hostname.startsWith("127."))
            return false;
          if (
            hostname.startsWith("10.") ||
            hostname.startsWith("192.168.") ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
          )
            return false;
          if (hostname.startsWith("169.254.")) return false;
          if (
            hostname === "169.254.169.254" ||
            hostname === "metadata.google.internal" ||
            hostname === "metadata.gce.internal"
          )
            return false;
          if (
            hostname === "::1" ||
            hostname.startsWith("fc00:") ||
            hostname.startsWith("fd00:") ||
            hostname.startsWith("fe80:")
          )
            return false;
          if (
            hostname.includes(".internal") ||
            hostname.includes(".local") ||
            hostname.endsWith(".consul")
          )
            return false;

          return true;
        } catch {
          return false;
        }
      }, "URL must use HTTPS and cannot access private networks, localhost, or cloud metadata services"),
    platform: z.enum(["woocommerce", "shopify"], {
      errorMap: () => ({ message: "Platform must be woocommerce or shopify" }),
    }),
    apiCredentials: z.record(z.any()).refine((creds) => {
      return typeof creds === "object" && creds !== null;
    }, "API credentials must be provided"),
    syncConfig: z.record(z.any()).optional().default({}),
  })
  .superRefine((data, ctx) => {
    const creds = data.apiCredentials;

    if (data.platform === "woocommerce") {
      if (
        !creds.consumer_key ||
        typeof creds.consumer_key !== "string" ||
        creds.consumer_key.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Consumer Key is required for WooCommerce",
          path: ["apiCredentials", "consumer_key"],
        });
      }
      if (
        !creds.consumer_secret ||
        typeof creds.consumer_secret !== "string" ||
        creds.consumer_secret.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Consumer Secret is required for WooCommerce",
          path: ["apiCredentials", "consumer_secret"],
        });
      }
    } else if (data.platform === "shopify") {
      if (
        !creds.access_token ||
        typeof creds.access_token !== "string" ||
        creds.access_token.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Access Token is required for Shopify",
          path: ["apiCredentials", "access_token"],
        });
      }
      if (
        !creds.api_secret ||
        typeof creds.api_secret !== "string" ||
        creds.api_secret.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API Secret is required for Shopify webhook validation",
          path: ["apiCredentials", "api_secret"],
        });
      }
    }
  });

export const updateStoreSchema = z
  .object({
    storeName: z
      .string()
      .min(1, "Store name is required")
      .max(255, "Store name too long")
      .optional(),
    storeUrl: z
      .string()
      .url("Must be a valid URL")
      .refine(
        (url) => {
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:") return false;

            const hostname = parsed.hostname.toLowerCase();
            if (hostname === "localhost" || hostname.startsWith("127."))
              return false;
            if (
              hostname.startsWith("10.") ||
              hostname.startsWith("192.168.") ||
              hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
            )
              return false;
            if (hostname.startsWith("169.254.")) return false;
            if (
              hostname === "169.254.169.254" ||
              hostname === "metadata.google.internal" ||
              hostname === "metadata.gce.internal"
            )
              return false;
            if (
              hostname === "::1" ||
              hostname.startsWith("fc00:") ||
              hostname.startsWith("fd00:") ||
              hostname.startsWith("fe80:")
            )
              return false;
            if (
              hostname.includes(".internal") ||
              hostname.includes(".local") ||
              hostname.endsWith(".consul")
            )
              return false;

            return true;
          } catch {
            return false;
          }
        },
        "URL must use HTTPS and cannot access private networks, localhost, or cloud metadata services",
      )
      .optional(),
    platform: z.enum(["woocommerce", "shopify"]).optional(),
    apiCredentials: z.record(z.any()).optional(),
    syncConfig: z.record(z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    // If apiCredentials is provided and platform is Shopify, validate required fields
    if (data.apiCredentials && data.platform === "shopify") {
      const creds = data.apiCredentials;

      if (
        !creds.access_token ||
        typeof creds.access_token !== "string" ||
        creds.access_token.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Access Token is required for Shopify",
          path: ["apiCredentials", "access_token"],
        });
      }
      if (
        !creds.api_secret ||
        typeof creds.api_secret !== "string" ||
        creds.api_secret.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API Secret is required for Shopify webhook validation",
          path: ["apiCredentials", "api_secret"],
        });
      }
    }

    // If apiCredentials is provided and platform is WooCommerce, validate required fields
    if (data.apiCredentials && data.platform === "woocommerce") {
      const creds = data.apiCredentials;

      if (
        !creds.consumer_key ||
        typeof creds.consumer_key !== "string" ||
        creds.consumer_key.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Consumer Key is required for WooCommerce",
          path: ["apiCredentials", "consumer_key"],
        });
      }
      if (
        !creds.consumer_secret ||
        typeof creds.consumer_secret !== "string" ||
        creds.consumer_secret.trim() === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Consumer Secret is required for WooCommerce",
          path: ["apiCredentials", "consumer_secret"],
        });
      }
    }
  });

export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({
  id: true,
  lastUpdated: true,
});

export const insertNotificationSchema = createInsertSchema(notifications, {
  createdAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryMovementSchema = createInsertSchema(
  inventoryMovementsQueue,
  {
    createdAt: () => z.date().optional(),
    lastAttemptAt: () => z.date().optional(),
    nextAttemptAt: () => z.date().optional(),
    processedAt: () => z.date().optional(),
  },
).omit({
  id: true,
  createdAt: true,
});

export const insertUnmappedSkuSchema = createInsertSchema(unmappedSkus, {
  createdAt: () => z.date().optional(),
  lastSeenAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertSyncLockSchema = createInsertSchema(syncLocks, {
  lockedAt: () => z.date().optional(),
}).omit({
  id: true,
  lockedAt: true,
});

// Types
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type InsertStoreIntegration = z.infer<
  typeof insertStoreIntegrationSchema
>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertInventoryMovement = z.infer<
  typeof insertInventoryMovementSchema
>;
export type InsertUnmappedSku = z.infer<typeof insertUnmappedSkuSchema>;
export type InsertSyncLock = z.infer<typeof insertSyncLockSchema>;

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type SyncLog = typeof syncLogs.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type StoreIntegration = typeof storeIntegrations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type InventoryMovement = typeof inventoryMovementsQueue.$inferSelect;
export type UnmappedSku = typeof unmappedSkus.$inferSelect;
export type SyncLock = typeof syncLocks.$inferSelect;
