import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { User } from "@shared/schema";

// Proper TypeScript interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user: User;
}
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertTenantSchema, insertUserSchema, createStoreSchema, updateStoreSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { WooCommerceConnector } from "./connectors/WooCommerceConnector";
import { ShopifyConnector } from "./connectors/ShopifyConnector";
import { ContificoConnector } from './connectors/ContificoConnector';
import { SyncService } from './services/SyncService';
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
      const user = (req as AuthenticatedRequest).user;
      if (!user.tenantId) {
        return res.status(400).json({ message: "User has no tenant" });
      }
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
      const user = (req as AuthenticatedRequest).user;
      if (!user.tenantId) {
        return res.status(400).json({ message: "User has no tenant" });
      }
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
      const user = (req as AuthenticatedRequest).user;
      
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
      const user = (req as AuthenticatedRequest).user;
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
      const user = (req as AuthenticatedRequest).user;
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

  // ============================================
  // INTEGRATION ENDPOINTS
  // ============================================

  // Get all integrations for current tenant
  app.get("/api/integrations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user.tenantId) {
        return res.status(400).json({ message: "Usuario sin tenant" });
      }

      const integrations = await storage.getIntegrationsByTenant(user.tenantId);
      res.json(integrations);
    } catch (error: any) {
      console.error("Error obteniendo integraciones:", error);
      res.status(500).json({ message: "Error al obtener integraciones", error: error.message });
    }
  });

  // Get a specific integration
  app.get("/api/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { integrationId } = req.params;

      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      res.json(integration);
    } catch (error: any) {
      console.error("Error obteniendo integración:", error);
      res.status(500).json({ message: "Error al obtener integración", error: error.message });
    }
  });

  // Create a new integration
  app.post("/api/integrations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { integrationType, name, settings } = req.body;

      // Validación básica
      if (!integrationType || !name || !settings) {
        return res.status(400).json({ 
          message: "Tipo de integración, nombre y configuración son requeridos" 
        });
      }

      // Validar tipos soportados
      const supportedTypes = ['contifico'];
      if (!supportedTypes.includes(integrationType)) {
        return res.status(400).json({ 
          message: `Tipo de integración no soportado. Tipos válidos: ${supportedTypes.join(', ')}` 
        });
      }

      // Crear integración
      const integration = await storage.createIntegration({
        tenantId: user.tenantId,
        integrationType,
        name,
        settings,
        isActive: true
      });

      res.status(201).json({ 
        integration,
        message: "Integración creada exitosamente" 
      });
    } catch (error: any) {
      console.error("Error creando integración:", error);
      res.status(500).json({ message: "Error al crear integración", error: error.message });
    }
  });

  // Update an integration
  app.put("/api/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { integrationId } = req.params;
      const { name, settings, isActive } = req.body;

      // Verificar que la integración existe y pertenece al tenant
      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      // Actualizar integración
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (settings !== undefined) updates.settings = settings;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedIntegration = await storage.updateIntegration(
        parseInt(integrationId),
        updates
      );

      res.json({ 
        integration: updatedIntegration,
        message: "Integración actualizada exitosamente" 
      });
    } catch (error: any) {
      console.error("Error actualizando integración:", error);
      res.status(500).json({ message: "Error al actualizar integración", error: error.message });
    }
  });

  // Delete an integration
  app.delete("/api/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { integrationId } = req.params;

      // Verificar que la integración existe y pertenece al tenant
      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      // Eliminar integración (las relaciones se eliminan en cascada)
      await storage.deleteIntegration(parseInt(integrationId));

      res.json({ message: "Integración eliminada exitosamente" });
    } catch (error: any) {
      console.error("Error eliminando integración:", error);
      res.status(500).json({ message: "Error al eliminar integración", error: error.message });
    }
  });

  // Test integration connection (for Contífico)
  app.post("/api/integrations/:integrationId/test-connection", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { integrationId } = req.params;

      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      // Solo soportamos Contífico por ahora
      if (integration.integrationType !== 'contifico') {
        return res.status(400).json({ 
          message: "Prueba de conexión solo disponible para integraciones Contífico" 
        });
      }

      // Crear un store temporal para probar la conexión
      const settings = integration.settings as any;
      const tempStore = {
        id: 0,
        tenantId: user.tenantId,
        platform: 'contifico',
        storeName: integration.name,
        storeUrl: 'https://api.contifico.com',
        apiCredentials: settings,
        syncConfig: {},
        status: 'active',
        connectionStatus: 'untested',
        lastConnectionTest: null,
        storeInfo: {},
        productsCount: 0,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { ContificoConnector } = await import('./connectors/ContificoConnector');
      const connector = new ContificoConnector(tempStore);
      const result = await connector.testConnection();

      res.json(result);
    } catch (error: any) {
      console.error("Error probando conexión de integración:", error);
      res.status(500).json({ 
        message: "Error al probar conexión", 
        error: error.message 
      });
    }
  });

  // ============================================
  // STORE-INTEGRATION RELATIONSHIPS
  // ============================================

  // Get integrations linked to a store
  app.get("/api/stores/:storeId/integrations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;

      // Verificar que la tienda existe y pertenece al tenant
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      const storeIntegrations = await storage.getStoreIntegrations(parseInt(storeId));

      // Obtener detalles completos de cada integración
      const integrationsWithDetails = await Promise.all(
        storeIntegrations.map(async (si) => {
          const integration = await storage.getIntegration(si.integrationId);
          return {
            ...si,
            integration
          };
        })
      );

      res.json(integrationsWithDetails);
    } catch (error: any) {
      console.error("Error obteniendo integraciones de tienda:", error);
      res.status(500).json({ 
        message: "Error al obtener integraciones", 
        error: error.message 
      });
    }
  });

  // Link an integration to a store
  app.post("/api/stores/:storeId/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId, integrationId } = req.params;
      const { syncConfig } = req.body;

      // Verificar tienda
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      // Verificar integración
      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      // Crear relación
      const link = await storage.linkStoreIntegration({
        storeId: parseInt(storeId),
        integrationId: parseInt(integrationId),
        syncConfig: syncConfig || {},
        isActive: true
      });

      res.status(201).json({ 
        link,
        message: "Integración vinculada exitosamente a la tienda" 
      });
    } catch (error: any) {
      console.error("Error vinculando integración:", error);

      // Manejar duplicados
      if (error.code === '23505') {
        return res.status(400).json({ 
          message: "Esta integración ya está vinculada a la tienda" 
        });
      }

      res.status(500).json({ 
        message: "Error al vincular integración", 
        error: error.message 
      });
    }
  });

  // Update a store-integration link (toggle sync, change config)
  app.put("/api/stores/:storeId/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId, integrationId } = req.params;
      const { isActive, syncConfig } = req.body;

      // Verificar tienda
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      // Verificar integración
      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      // Buscar el link existente
      const storeIntegrations = await storage.getStoreIntegrations(parseInt(storeId));
      const link = storeIntegrations.find(si => si.integrationId === parseInt(integrationId));

      if (!link) {
        return res.status(404).json({ 
          message: "Esta integración no está vinculada a la tienda" 
        });
      }

      // Actualizar el link
      const updates: any = {};
      if (isActive !== undefined) updates.isActive = isActive;
      if (syncConfig !== undefined) updates.syncConfig = syncConfig;

      const updatedLink = await storage.updateStoreIntegration(link.id, updates);

      res.json({ 
        link: updatedLink,
        message: "Configuración de sincronización actualizada exitosamente" 
      });
    } catch (error: any) {
      console.error("Error actualizando store integration:", error);
      res.status(500).json({ 
        message: "Error al actualizar configuración", 
        error: error.message 
      });
    }
  });

  // Unlink an integration from a store
  app.delete("/api/stores/:storeId/integrations/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId, integrationId } = req.params;

      // Verificar tienda
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      // Desvincular
      await storage.unlinkStoreIntegration(
        parseInt(storeId),
        parseInt(integrationId)
      );

      res.json({ message: "Integración desvinculada exitosamente" });
    } catch (error: any) {
      console.error("Error desvinculando integración:", error);
      res.status(500).json({ 
        message: "Error al desvincular integración", 
        error: error.message 
      });
    }
  });

  // Helper function to get connector for a store
  const getConnector = (store: any) => {
    switch (store.platform) {
      case 'woocommerce':
        return new WooCommerceConnector(store);
      case 'shopify':
        return new ShopifyConnector(store);
      case 'contifico':
        return new ContificoConnector(store);
      default:
        throw new Error(`Unsupported platform: ${store.platform}`);
    }
  };

  // Test store connection with status persistence
  app.post("/api/stores/:storeId/test-connection", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { storeId } = req.params; // Move storeId outside try block for error handler access
    try {
      const user = (req as AuthenticatedRequest).user;
      
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
      const user = (req as AuthenticatedRequest).user;
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
      const user = (req as AuthenticatedRequest).user;
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
      const user = (req as AuthenticatedRequest).user;
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
      const user = (req as AuthenticatedRequest).user;
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
      
      if (!force_refresh && hasRecentCache && store.connectionStatus === 'connected' && (store as any).storeVersion) {
        // Return cached store info
        result = {
          name: store.storeName,
          domain: store.storeUrl,
          version: (store as any).storeVersion,
          products_count: store.productsCount,
          cached: true,
          last_updated: store.lastConnectionTest
        };
      } else {
        // Fetch fresh store info from API
        const connector = getConnector(store);
        const storeInfo = await connector.getStoreInfo();
        
        // Cache the fresh info
        await storage.updateStore(parseInt(storeId), {
          storeName: storeInfo.name,
          productsCount: storeInfo.products_count,
          lastConnectionTest: new Date(),
          connectionStatus: 'connected'
        });
        
        result = {
          ...storeInfo,
          cached: false
        };
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching store info:", error);
      res.status(500).json({ message: "Failed to fetch store info", error: error.message });
    }
  });

  // Inventory sync routes
  
  // Get sync status for a store
  app.get("/api/sync/inventory/:storeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Get latest sync logs
      const recentLogs = await storage.getSyncLogsByStore(parseInt(storeId), 5);
      
      res.json({
        storeId: parseInt(storeId),
        storeName: store.storeName,
        platform: store.platform,
        productsCount: store.productsCount,
        lastSyncAt: store.lastSyncAt,
        connectionStatus: store.connectionStatus,
        recentLogs
      });
    } catch (error: any) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status", error: error.message });
    }
  });

  // Trigger manual inventory sync
  app.post("/api/sync/inventory/:storeId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (store.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Store connection is not active" });
      }

      const syncStartTime = Date.now();
      let syncLog: any;
      
      try {
        // Create initial sync log
        syncLog = await storage.createSyncLog({
          tenantId: user.tenantId,
          storeId: parseInt(storeId),
          syncType: 'inventory',
          status: 'running',
          syncedCount: 0,
          errorCount: 0,
          durationMs: null,
          errorMessage: null,
          details: { manual: true, startedAt: new Date() }
        });

        // Perform the sync
        const connector = getConnector(store);
        const productsResult = await connector.getProducts();
        
        // Update products in database
        let syncedCount = 0;
        let errorCount = 0;
        
        for (const product of productsResult.products) {
          try {
            await storage.upsertProduct({
              tenantId: user.tenantId,
              storeId: parseInt(storeId),
              platformProductId: product.id.toString(),
              sku: product.sku || null,
              name: product.name,
              price: Math.round((product.price || 0) * 100), // Store as cents
              stockQuantity: product.stock_quantity || 0,
              manageStock: product.manage_stock || false,
              data: product
            });
            syncedCount++;
          } catch (error) {
            console.error(`Error syncing product ${product.id}:`, error);
            errorCount++;
          }
        }
        
        const durationMs = Date.now() - syncStartTime;
        
        // Update sync log with results
        await storage.createSyncLog({
          tenantId: user.tenantId,
          storeId: parseInt(storeId),
          syncType: 'inventory',
          status: errorCount > 0 ? 'completed_with_errors' : 'completed',
          syncedCount,
          errorCount,
          durationMs,
          errorMessage: null,
          details: { 
            manual: true, 
            totalProducts: productsResult.products.length,
            completedAt: new Date()
          }
        });
        
        // Update store sync status
        await storage.updateStoreSyncStatus(parseInt(storeId), syncedCount, new Date());
        
        res.json({
          success: true,
          syncedCount,
          errorCount,
          durationMs,
          totalProducts: productsResult.products.length
        });
        
      } catch (syncError: any) {
        const durationMs = Date.now() - syncStartTime;
        
        // Log sync failure
        await storage.createSyncLog({
          tenantId: user.tenantId,
          storeId: parseInt(storeId),
          syncType: 'inventory',
          status: 'failed',
          syncedCount: 0,
          errorCount: 1,
          durationMs,
          errorMessage: syncError.message,
          details: { manual: true, error: syncError.message }
        });
        
        throw syncError;
      }
      
    } catch (error: any) {
      console.error("Error during inventory sync:", error);
      res.status(500).json({ message: "Failed to sync inventory", error: error.message });
    }
  });

  // Get sync history for a store  
  app.get("/api/sync/inventory/:storeId/logs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      const logs = await storage.getSyncLogsByStore(parseInt(storeId), limit);
      
      res.json({
        storeId: parseInt(storeId),
        logs
      });
    } catch (error: any) {
      console.error("Error fetching sync logs:", error);
      res.status(500).json({ message: "Failed to fetch sync logs", error: error.message });
    }
  });

  // ============================================
  // SYNC ENDPOINTS
  // ============================================

  // Sincronización manual Pull (Contífico → Tienda)
  app.post("/api/sync/pull/:storeId/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId, integrationId } = req.params;
      const { dryRun = false, limit = 1000 } = req.body;

      // Verificar que la tienda pertenece al tenant del usuario
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      // Verificar que la integración pertenece al tenant del usuario
      const integration = await storage.getIntegration(parseInt(integrationId));
      if (!integration || integration.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Integración no encontrada" });
      }

      console.log(`[API] Iniciando sincronización Pull para store ${storeId}`);

      const result = await SyncService.pullFromIntegration(
        parseInt(storeId),
        parseInt(integrationId),
        { dryRun, limit }
      );

      res.json({
        success: true,
        result,
        message: `Sincronización completada: ${result.success} productos actualizados, ${result.failed} fallidos, ${result.skipped} omitidos`
      });

    } catch (error: any) {
      console.error("[API] Error en sincronización Pull:", error);
      res.status(500).json({
        message: "Error al sincronizar",
        error: error.message
      });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
