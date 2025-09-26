import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertTenantSchema, insertUserSchema, createStoreSchema, updateStoreSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { WooCommerceConnector } from "./connectors/WooCommerceConnector";
import { ShopifyConnector } from "./connectors/ShopifyConnector";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Tenant registration endpoint
  app.post("/api/register-tenant", async (req, res) => {
    try {
      const { tenantName, subdomain, userEmail, userName, password } = req.body;

      // Check if subdomain already exists
      const existingTenant = await storage.getTenantBySubdomain(subdomain);
      if (existingTenant) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }

      // Check if user email already exists
      const existingUser = await storage.getUserByEmail(userEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Create tenant
      const apiKey = randomBytes(32).toString('hex');
      const tenant = await storage.createTenant({
        name: tenantName,
        subdomain,
        planType: "starter",
        status: "active",
        settings: {},
        apiKey,
      });

      res.status(201).json({ tenant, message: "Tenant created successfully" });
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  // Get current tenant info
  app.get("/api/tenant/current", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant" });
    }
  });

  // Get stores for current tenant
  app.get("/api/stores", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const stores = await storage.getStoresByTenant(user.tenantId);
      res.json(stores);
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  // Create a new store connection
  app.post("/api/stores", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      
      // Validate input with Zod
      const validatedData = createStoreSchema.parse(req.body);
      
      // Create store with tenant ID and initial status
      const storeData = {
        ...validatedData,
        tenantId: user.tenantId,
        connectionStatus: "untested" as const,
        storeInfo: {},
        productsCount: 0
      };

      const store = await storage.createStore(storeData);
      
      // Test connection immediately after creation
      try {
        const connector = getConnector(store);
        const connectionResult = await connector.testConnection();
        
        if (connectionResult.success) {
          // Update store with connection info
          const updatedStore = await storage.updateStore(store.id, {
            connectionStatus: "connected",
            lastConnectionTest: new Date(),
            storeInfo: {
              store_name: connectionResult.store_name,
              domain: connectionResult.domain,
              version: connectionResult.version,
              products_count: connectionResult.products_count,
              ...connectionResult.details
            },
            productsCount: connectionResult.products_count || 0
          });
          
          res.status(201).json({
            store: updatedStore,
            connection: connectionResult,
            message: "Store connected successfully"
          });
        } else {
          // Update store with failed status
          await storage.updateStore(store.id, {
            connectionStatus: "failed",
            lastConnectionTest: new Date(),
            storeInfo: { error: connectionResult.error }
          });
          
          res.status(201).json({
            store,
            connection: connectionResult,
            message: "Store created but connection failed"
          });
        }
      } catch (connectionError: any) {
        // Update store with error status
        await storage.updateStore(store.id, {
          connectionStatus: "error",
          lastConnectionTest: new Date(),
          storeInfo: { error: connectionError.message }
        });
        
        res.status(201).json({
          store,
          connection: { success: false, error: connectionError.message },
          message: "Store created but connection test failed"
        });
      }
      
    } catch (error: any) {
      console.error("Error creating store:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      res.status(500).json({ message: "Failed to create store", error: error.message });
    }
  });

  // Update an existing store
  app.put("/api/stores/:storeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId } = req.params;
      
      // Validate input with Zod
      const validatedData = updateStoreSchema.parse(req.body);
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Update store
      const updatedStore = await storage.updateStore(parseInt(storeId), validatedData);
      
      // If API credentials were updated, test connection
      if (validatedData.apiCredentials || validatedData.storeUrl) {
        try {
          const connector = getConnector(updatedStore);
          const connectionResult = await connector.testConnection();
          
          await storage.updateStore(parseInt(storeId), {
            connectionStatus: connectionResult.success ? "connected" : "failed",
            lastConnectionTest: new Date(),
            storeInfo: connectionResult.success ? {
              store_name: connectionResult.store_name,
              domain: connectionResult.domain,
              version: connectionResult.version,
              products_count: connectionResult.products_count,
              ...connectionResult.details
            } : { error: connectionResult.error },
            productsCount: connectionResult.products_count || 0
          });
          
          const finalStore = await storage.getStore(parseInt(storeId));
          res.json({
            store: finalStore,
            connection: connectionResult,
            message: connectionResult.success ? "Store updated and connection verified" : "Store updated but connection failed"
          });
        } catch (connectionError: any) {
          await storage.updateStore(parseInt(storeId), {
            connectionStatus: "error",
            lastConnectionTest: new Date(),
            storeInfo: { error: connectionError.message }
          });
          
          const finalStore = await storage.getStore(parseInt(storeId));
          res.json({
            store: finalStore,
            connection: { success: false, error: connectionError.message },
            message: "Store updated but connection test failed"
          });
        }
      } else {
        res.json({
          store: updatedStore,
          message: "Store updated successfully"
        });
      }
      
    } catch (error: any) {
      console.error("Error updating store:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      res.status(500).json({ message: "Failed to update store", error: error.message });
    }
  });

  // Delete a store
  app.delete("/api/stores/:storeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId } = req.params;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      await storage.deleteStore(parseInt(storeId));
      
      res.json({ message: "Store deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting store:", error);
      res.status(500).json({ message: "Failed to delete store", error: error.message });
    }
  });

  // Helper function to get connector for a store
  const getConnector = (store: any) => {
    switch (store.platform) {
      case 'woocommerce':
        return new WooCommerceConnector(store);
      case 'shopify':
        return new ShopifyConnector(store);
      default:
        throw new Error(`Unsupported platform: ${store.platform}`);
    }
  };

  // Test store connection with status persistence
  app.post("/api/stores/:storeId/test-connection", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId } = req.params;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      const connector = getConnector(store);
      const result = await connector.testConnection();
      
      // Persist connection test result and status
      const connectionStatus = result.success ? 'connected' : 'error';
      const storeInfoToCache = result.success ? {
        storeName: result.store_name || store.storeName,
        storeVersion: result.version,
        productsCount: result.products_count,
        lastConnectionTest: new Date()
      } : {
        lastConnectionTest: new Date()
      };

      await storage.updateStore(parseInt(storeId), {
        connectionStatus,
        ...storeInfoToCache
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error testing store connection:", error);
      
      // Persist error status even on failure
      try {
        await storage.updateStore(parseInt(storeId), {
          connectionStatus: 'error',
          lastConnectionTest: new Date()
        });
      } catch (updateError) {
        console.error("Failed to persist connection error status:", updateError);
      }
      
      res.status(500).json({ message: "Failed to test connection", error: error.message });
    }
  });

  // Get products from a store with pagination support (including cursor-based for Shopify)
  app.get("/api/stores/:storeId/products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId } = req.params;
      const { page = "1", limit = "10", page_info } = req.query;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      const connector = getConnector(store);
      const result = await connector.getProducts(
        parseInt(page as string), 
        parseInt(limit as string),
        page_info as string
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products", error: error.message });
    }
  });

  // Get a specific product from a store
  app.get("/api/stores/:storeId/products/:productId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId, productId } = req.params;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      const connector = getConnector(store);
      const result = await connector.getProduct(productId);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product", error: error.message });
    }
  });

  // Update a product in a store
  app.put("/api/stores/:storeId/products/:productId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId, productId } = req.params;
      const productData = req.body;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      const connector = getConnector(store);
      const result = await connector.updateProduct(productId, productData);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product", error: error.message });
    }
  });

  // Get store information with caching
  app.get("/api/stores/:storeId/info", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user as any;
      const { storeId } = req.params;
      const { force_refresh } = req.query;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Check if we have cached info and it's recent (within 10 minutes)
      const cacheExpiry = 10 * 60 * 1000; // 10 minutes in milliseconds
      const hasRecentCache = store.lastConnectionTest && 
        (new Date().getTime() - new Date(store.lastConnectionTest).getTime()) < cacheExpiry;

      let result;
      
      if (!force_refresh && hasRecentCache && store.connectionStatus === 'connected' && store.storeVersion) {
        // Return cached store info
        result = {
          name: store.storeName,
          domain: store.storeUrl,
          version: store.storeVersion,
          products_count: store.productsCount,
          cached: true,
          last_updated: store.lastConnectionTest
        };
      } else {
        // Fetch fresh store info from API
        const connector = getConnector(store);
        result = await connector.getStoreInfo();
        
        // Cache the fresh info
        await storage.updateStore(parseInt(storeId), {
          storeName: result.name,
          storeVersion: result.version,
          productsCount: result.products_count,
          lastConnectionTest: new Date(),
          connectionStatus: 'connected'
        });
        
        result.cached = false;
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching store info:", error);
      res.status(500).json({ message: "Failed to fetch store info", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
