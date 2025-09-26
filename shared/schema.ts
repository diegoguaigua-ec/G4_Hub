import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, index, decimal, unique } from "drizzle-orm/pg-core";
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
  contificoEnvironment: varchar("contifico_environment", { length: 20 }).default("test"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  storeUrl: varchar("store_url", { length: 500 }).notNull(),
  apiCredentials: jsonb("api_credentials").notNull(),
  syncConfig: jsonb("sync_config").default({}),
  status: varchar("status", { length: 20 }).default("active"),
  // Connection tracking fields
  connectionStatus: varchar("connection_status", { length: 20 }).notNull().default("untested"),
  lastConnectionTest: timestamp("last_connection_test"),
  storeInfo: jsonb("store_info").notNull().default({}),
  productsCount: integer("products_count").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store products cache table
export const storeProducts = pgTable("store_products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  platformProductId: varchar("platform_product_id", { length: 100 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  name: varchar("name", { length: 255 }),
  price: integer("price"), // Store as cents to avoid decimal issues
  stockQuantity: integer("stock_quantity"),
  manageStock: boolean("manage_stock").notNull().default(false),
  data: jsonb("data"), // Full product data from platform
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_store_products_store_platform").on(table.storeId, table.platformProductId),
  // Unique constraint to prevent cache duplicates and ensure updateProduct idempotency
  unique("uq_store_products_store_platform").on(table.storeId, table.platformProductId)
]);

// Sync logs table
export const syncLogs = pgTable("sync_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }),
  syncType: varchar("sync_type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  syncedCount: integer("synced_count").default(0),
  errorCount: integer("error_count").default(0),
  durationMs: integer("duration_ms"),
  details: jsonb("details").default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  stores: many(stores),
  syncLogs: many(syncLogs),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stores.tenantId],
    references: [tenants.id],
  }),
  syncLogs: many(syncLogs),
  products: many(storeProducts),
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

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncLogs.tenantId],
    references: [tenants.id],
  }),
  store: one(stores, {
    fields: [syncLogs.storeId],
    references: [stores.id],
  }),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
  lastConnectionTest: true,
});

// Enhanced store validation schemas with security and platform-specific validation
export const createStoreSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(255, "Store name too long"),
  storeUrl: z.string()
    .url("Must be a valid URL")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        // SSRF protection: only allow https
        if (parsed.protocol !== 'https:') {
          return false;
        }
        // Block private IP ranges and localhost
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }, "URL must use HTTPS and cannot be a private/local address"),
  platform: z.enum(["woocommerce", "shopify", "contifico"], {
    errorMap: () => ({ message: "Platform must be woocommerce, shopify, or contifico" })
  }),
  apiCredentials: z.record(z.any()).refine((creds) => {
    // Basic structure validation - platform-specific validation happens in superRefine
    return typeof creds === 'object' && creds !== null;
  }, "API credentials must be provided"),
  syncConfig: z.record(z.any()).optional().default({})
}).superRefine((data, ctx) => {
  const creds = data.apiCredentials;
  
  // Platform-specific credential validation
  if (data.platform === "woocommerce") {
    if (!creds.consumer_key || typeof creds.consumer_key !== 'string' || creds.consumer_key.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Consumer Key is required for WooCommerce",
        path: ["apiCredentials", "consumer_key"]
      });
    }
    if (!creds.consumer_secret || typeof creds.consumer_secret !== 'string' || creds.consumer_secret.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Consumer Secret is required for WooCommerce", 
        path: ["apiCredentials", "consumer_secret"]
      });
    }
  } else if (data.platform === "shopify") {
    if (!creds.access_token || typeof creds.access_token !== 'string' || creds.access_token.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Access Token is required for Shopify",
        path: ["apiCredentials", "access_token"]
      });
    }
  } else if (data.platform === "contifico") {
    const hasTestKey = creds.test_api_key && typeof creds.test_api_key === 'string' && creds.test_api_key.trim() !== '';
    const hasProdKey = creds.prod_api_key && typeof creds.prod_api_key === 'string' && creds.prod_api_key.trim() !== '';
    
    if (!hasTestKey && !hasProdKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one API key (test or production) is required for Contífico",
        path: ["apiCredentials"]
      });
    }
  }
});

export const updateStoreSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(255, "Store name too long").optional(),
  storeUrl: z.string()
    .url("Must be a valid URL")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }, "URL must use HTTPS and cannot be a private/local address").optional(),
  apiCredentials: z.record(z.any()).optional(),
  syncConfig: z.record(z.any()).optional()
});

export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type SyncLog = typeof syncLogs.$inferSelect;
