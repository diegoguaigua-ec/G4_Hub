import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertTenantSchema, insertUserSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { WooCommerceConnector } from "./connectors/WooCommerceConnector";
import { ShopifyConnector } from "./connectors/ShopifyConnector";

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

  // Test store connection
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
      
      res.json(result);
    } catch (error: any) {
      console.error("Error testing store connection:", error);
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

  // Get store information
  app.get("/api/stores/:storeId/info", async (req, res) => {
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
      const result = await connector.getStoreInfo();
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching store info:", error);
      res.status(500).json({ message: "Failed to fetch store info", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
