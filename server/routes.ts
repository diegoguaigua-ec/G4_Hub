import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { User } from "@shared/schema";
import ExcelJS from "exceljs";
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

  // Get warehouses from Contífico integration
  app.get("/api/integrations/:integrationId/warehouses", async (req, res) => {
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

      // Solo soportamos Contífico
      if (integration.integrationType !== 'contifico') {
        return res.status(400).json({
          message: "Obtención de bodegas solo disponible para integraciones Contífico"
        });
      }

      // Crear un store temporal para obtener bodegas
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
      const warehouses = await connector.getWarehouses();

      res.json({ warehouses });
    } catch (error: any) {
      console.error("Error obteniendo bodegas de Contífico:", error);
      res.status(500).json({
        message: "Error al obtener bodegas",
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

  // Get product sync status comparison (Inventory Tab)
  // IMPORTANT: This route must be BEFORE the generic /products/:productId route
  app.get("/api/stores/:storeId/products/sync-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;
      const {
        page = "1",
        limit = "20",
        status: statusFilter,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Verify store access
      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Find Contífico integration linked to this store
      const storeIntegrations = await storage.getStoreIntegrations(parseInt(storeId));

      // Get integration details for each store integration
      let contificoIntegration = null;
      for (const si of storeIntegrations) {
        const integration = await storage.getIntegration(si.integrationId);
        if (integration && (
          integration.name?.toLowerCase().includes('contífico') ||
          integration.name?.toLowerCase().includes('contifico')
        )) {
          contificoIntegration = si;
          break;
        }
      }

      if (!contificoIntegration) {
        return res.status(404).json({
          message: "No se encontró integración de Contífico para esta tienda"
        });
      }

      // Get all store products (cached) - these are the products in the store
      const allStoreProducts = await storage.getProductsByStore(parseInt(storeId));

      // Filter products with SKU only
      const storeProductsWithSku = allStoreProducts.filter((p: any) => p.sku);

      // Get the latest PULL sync log for this store (inventory sync from Contífico)
      const recentLogs = await storage.getSyncLogsByStoreAndType(parseInt(storeId), 'pull', 1);
      const latestSyncLog = recentLogs && recentLogs.length > 0 ? recentLogs[0] : null;

      // Create a map of sync log items by SKU for quick lookup
      const syncLogItemsMap = new Map();
      if (latestSyncLog) {
        const syncItems = await storage.getSyncLogItems(latestSyncLog.id);
        syncItems.forEach((item: any) => {
          if (item.sku) {
            syncLogItemsMap.set(item.sku, item);
          }
        });
      }

      // Build comparison data based on STORE products (what's in my store?)
      const comparisonData = storeProductsWithSku.map((storeProduct: any) => {
        const syncItem = syncLogItemsMap.get(storeProduct.sku);

        let syncStatus = 'pending'; // pending, synced, different, not_in_contifico, error
        let stockContifico: number | null = null;
        let lastSync: Date | null = null;

        if (!syncItem) {
          // Never synced with Contífico
          syncStatus = 'pending';
        } else {
          lastSync = syncItem.createdAt;

          if (syncItem.errorCategory === 'not_found_contifico') {
            // Product doesn't exist in Contífico
            syncStatus = 'not_in_contifico';
            stockContifico = null;
          } else if (syncItem.status === 'failed') {
            // Sync failed
            syncStatus = 'error';
            stockContifico = null;
          } else if (syncItem.status === 'success' || syncItem.status === 'skipped') {
            // Sync was successful or skipped (no changes)
            stockContifico = syncItem.stockAfter;

            if (storeProduct.stockQuantity === syncItem.stockAfter) {
              syncStatus = 'synced';
            } else {
              syncStatus = 'different';
            }
          }
        }

        return {
          sku: storeProduct.sku,
          name: storeProduct.name,
          stockStore: storeProduct.stockQuantity,
          stockContifico: stockContifico,
          status: syncStatus,
          lastSync: lastSync,
          platformProductId: storeProduct.platformProductId,
        };
      });

      // Apply search filter
      let filteredData = comparisonData;
      if (search && typeof search === 'string' && search.trim() !== '') {
        const searchLower = search.trim().toLowerCase();
        filteredData = filteredData.filter((item: any) =>
          item.sku?.toLowerCase().includes(searchLower) ||
          item.name?.toLowerCase().includes(searchLower)
        );
      }

      // Apply status filter
      if (statusFilter && typeof statusFilter === 'string' && statusFilter !== 'all') {
        filteredData = filteredData.filter((item: any) => item.status === statusFilter);
      }

      // Calculate total before pagination
      const total = filteredData.length;

      // Apply pagination
      const paginatedData = filteredData.slice(offset, offset + limitNum);

      res.json({
        products: paginatedData,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasMore: offset + limitNum < total,
        },
        lastSyncAt: latestSyncLog?.createdAt || null,
      });
    } catch (error: any) {
      console.error("Error fetching product sync status:", error);
      res.status(500).json({
        message: "Failed to fetch product sync status",
        error: error.message
      });
    }
  });

  // Get sync statistics for a store
  app.get("/api/stores/:storeId/sync-stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId } = req.params;

      const store = await storage.getStore(parseInt(storeId));
      if (!store || store.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Tienda no encontrada" });
      }

      // Get last sync of type 'pull'
      const pullSyncs = await storage.getSyncLogsByStoreAndType(
        parseInt(storeId),
        'pull',
        1
      );
      const lastSyncAt = pullSyncs[0]?.createdAt || null;

      // Count products in store_products for this store
      const allProducts = await storage.getProductsByStore(parseInt(storeId));
      const totalProducts = allProducts.length;

      // Calculate success rate from last 30 days of pull syncs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSyncs = await storage.getSyncLogsByStoreAndType(
        parseInt(storeId),
        'pull',
        100  // Get last 100 syncs to calculate from last 30 days
      );

      const syncsLast30Days = recentSyncs.filter(
        sync => sync.createdAt && new Date(sync.createdAt) >= thirtyDaysAgo
      );

      let successRate = 0;
      if (syncsLast30Days.length > 0) {
        const successfulSyncs = syncsLast30Days.filter(
          sync => sync.status === 'completed'
        ).length;
        successRate = Math.round((successfulSyncs / syncsLast30Days.length) * 100);
      }

      res.json({
        lastSyncAt,
        totalProducts,
        successRate,
      });
    } catch (error: any) {
      console.error("Error obteniendo estadísticas de sincronización:", error);
      res.status(500).json({
        message: "Error al obtener estadísticas",
        error: error.message
      });
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

        // Update the initial sync log with results (instead of creating a new one)
        await storage.updateSyncLog(syncLog.id, {
          status: errorCount > 0 ? 'completed_with_errors' : 'completed',
          syncedCount,
          errorCount,
          durationMs,
          errorMessage: null,
          details: {
            manual: true,
            startedAt: new Date(syncStartTime),
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

        // Update sync log with failure status (instead of creating a new one)
        if (syncLog && syncLog.id) {
          await storage.updateSyncLog(syncLog.id, {
            status: 'failed',
            syncedCount: 0,
            errorCount: 1,
            durationMs,
            errorMessage: syncError.message,
            details: {
              manual: true,
              startedAt: new Date(syncStartTime),
              error: syncError.message,
              failedAt: new Date()
            }
          });
        }

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

  // Pull selectivo: sincroniza solo productos seleccionados por SKU
  app.post("/api/sync/pull-selective/:storeId/:integrationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { storeId, integrationId } = req.params;
      const { skus, dryRun = false } = req.body;

      // Validar que se proporcionen SKUs
      if (!skus || !Array.isArray(skus) || skus.length === 0) {
        return res.status(400).json({
          message: "Debe proporcionar una lista de SKUs para sincronizar"
        });
      }

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

      console.log(`[API] Iniciando sincronización Pull Selectiva para store ${storeId}`);
      console.log(`[API] SKUs seleccionados: ${skus.join(', ')}`);

      const result = await SyncService.pullFromIntegrationSelective(
        parseInt(storeId),
        parseInt(integrationId),
        skus,
        { dryRun }
      );

      res.json({
        success: true,
        result,
        message: `Sincronización selectiva completada: ${result.success} productos actualizados, ${result.failed} fallidos, ${result.skipped} omitidos`
      });

    } catch (error: any) {
      console.error("[API] Error en sincronización Pull Selectiva:", error);
      res.status(500).json({
        message: "Error al sincronizar productos seleccionados",
        error: error.message
      });
    }
  });

  // ============================================
  // SYNC LOGS ENDPOINTS
  // ============================================

  /**
   * GET /api/sync/logs
   * Listar sincronizaciones con filtros y paginación
   */
  app.get("/api/sync/logs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { 
        storeId, 
        status, 
        limit = '20', 
        offset = '0' 
      } = req.query;

      console.log('[API] Obteniendo logs de sincronización', { 
        tenantId: user.tenantId, 
        storeId, 
        status, 
        limit, 
        offset 
      });

      const options: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      if (storeId) {
        options.storeId = parseInt(storeId as string);
      }

      if (status) {
        options.status = status as string;
      }

      const result = await storage.getSyncLogs(user.tenantId, options);

      // Enriquecer logs con información de tienda
      const logsWithStoreInfo = await Promise.all(
        result.logs.map(async (log) => {
          const store = log.storeId !== null
          ? await storage.getStore(log.storeId) 
          : null;
          return {
            ...log,
            storeName: store?.storeName || 'N/A',
            storePlatform: store?.platform || 'N/A',
          };
        })
      );

      res.json({
        logs: logsWithStoreInfo,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + options.limit < result.total
        }
      });

    } catch (error: any) {
      console.error('[API] Error obteniendo logs:', error);
      res.status(500).json({ 
        message: "Error al obtener logs de sincronización", 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/sync/logs/:id
   * Obtener detalle de una sincronización con sus items
   */
  app.get("/api/sync/logs/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;

      console.log('[API] Obteniendo detalle de log', { syncLogId: id });

      const result = await storage.getSyncLogWithItems(parseInt(id));

      if (!result.syncLog) {
        return res.status(404).json({ message: "Log de sincronización no encontrado" });
      }

      // Verificar que pertenece al tenant del usuario
      if (result.syncLog.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "No autorizado para ver este log" });
      }

      // Obtener información de tienda
      const store = result.syncLog.storeId 
        ? await storage.getStore(result.syncLog.storeId)
        : null;

      // Obtener estadísticas de errores por categoría
      const errorStats = await storage.getSyncLogItemsErrorStats(parseInt(id));

      res.json({
        syncLog: {
          ...result.syncLog,
          storeName: store?.storeName || 'N/A',
          storePlatform: store?.platform || 'N/A',
        },
        items: result.items,
        errorStats,
        summary: {
          total: result.items.length,
          success: result.items.filter(i => i.status === 'success').length,
          failed: result.items.filter(i => i.status === 'failed').length,
          skipped: result.items.filter(i => i.status === 'skipped').length,
        }
      });

    } catch (error: any) {
      console.error('[API] Error obteniendo detalle de log:', error);
      res.status(500).json({ 
        message: "Error al obtener detalle de sincronización", 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/sync/stats
   * Obtener métricas agregadas para Dashboard
   */
  app.get("/api/sync/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { days = '7' } = req.query;

      console.log('[API] Obteniendo estadísticas de sincronización', { 
        tenantId: user.tenantId,
        days 
      });

      // Obtener logs de los últimos N días
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

      // Obtener todos los logs del período
      const allLogs = await storage.getSyncLogs(user.tenantId, { 
        limit: 1000 // Suficiente para stats
      });

      // Filtrar por fecha
      const recentLogs = allLogs.logs.filter(log => 
        new Date(log.createdAt) >= daysAgo
      );

      // Calcular métricas
      const totalSyncs = recentLogs.length;
      const totalProducts = recentLogs.reduce((sum, log) => sum + (log.syncedCount || 0), 0);
      const totalErrors = recentLogs.reduce((sum, log) => sum + (log.errorCount || 0), 0);
      const successfulSyncs = recentLogs.filter(log => log.status === 'success').length;
      const successRate = totalSyncs > 0 
        ? Math.round((successfulSyncs / totalSyncs) * 100) 
        : 0;

      // Logs recientes (últimos 5)
      const recentActivity = recentLogs
        .slice(0, 5)
        .map(log => ({
          id: log.id,
          storeId: log.storeId,
          syncType: log.syncType,
          status: log.status,
          syncedCount: log.syncedCount,
          errorCount: log.errorCount,
          createdAt: log.createdAt,
        }));

      res.json({
        period: {
          days: parseInt(days as string),
          from: daysAgo.toISOString(),
          to: new Date().toISOString(),
        },
        metrics: {
          totalSyncs,
          totalProducts,
          totalErrors,
          successRate,
        },
        recentActivity,
      });

    } catch (error: any) {
      console.error('[API] Error obteniendo estadísticas:', error);
      res.status(500).json({ 
        message: "Error al obtener estadísticas", 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/sync/logs/:id/export
   * Exportar productos de una sincronización a Excel
   */
  app.get("/api/sync/logs/:id/export", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;

      console.log("[API] Exportando log a Excel", { syncLogId: id });

      // Obtener el sync log con items
      const result = await storage.getSyncLogWithItems(parseInt(id));

      if (!result.syncLog) {
        return res
          .status(404)
          .json({ message: "Log de sincronización no encontrado" });
      }

      // Verificar que pertenece al tenant del usuario
      if (result.syncLog.tenantId !== user.tenantId) {
        return res
          .status(403)
          .json({ message: "No autorizado para exportar este log" });
      }

      // Importar ExcelJS dinámicamente
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Productos Sincronizados");

      // Obtener información de tienda
      let storeName = "N/A";
      if (result.syncLog.storeId && typeof result.syncLog.storeId === 'number') {
        try {
          const store = await storage.getStore(result.syncLog.storeId);
          if (store) {
            storeName = store.storeName;
          }
        } catch (error) {
          console.warn(`[API] No se pudo obtener tienda para export`);
        }
      }

      // Configurar columnas
      worksheet.columns = [
        { header: "SKU", key: "sku", width: 20 },
        { header: "Producto", key: "productName", width: 40 },
        { header: "Estado", key: "status", width: 15 },
        { header: "Stock Antes", key: "stockBefore", width: 15 },
        { header: "Stock Después", key: "stockAfter", width: 15 },
        { header: "Categoría Error", key: "errorCategory", width: 25 },
        { header: "Mensaje Error", key: "errorMessage", width: 50 },
      ];

      // Estilo del header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Filtrar solo productos con errores u omitidos
      const itemsToExport = result.items.filter(
        (item) => item.status === "failed" || item.status === "skipped"
      );

      // Agregar datos
      itemsToExport.forEach((item) => {
        const row = worksheet.addRow({
          sku: item.sku,
          productName: item.productName || "N/A",
          status:
            item.status === "failed"
              ? "Error"
              : item.status === "skipped"
              ? "Omitido"
              : item.status,
          stockBefore: item.stockBefore ?? "N/A",
          stockAfter: item.stockAfter ?? "N/A",
          errorCategory: item.errorCategory || "N/A",
          errorMessage: item.errorMessage || "N/A",
        });

        // Colorear fila según estado
        if (item.status === "failed") {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" }, // Rojo claro
          };
        } else if (item.status === "skipped") {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEB9C" }, // Amarillo claro
          };
        }
      });

      // Agregar hoja de resumen
      const summarySheet = workbook.addWorksheet("Resumen");
      summarySheet.columns = [
        { header: "Detalle", key: "label", width: 30 },
        { header: "Valor", key: "value", width: 20 },
      ];

      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      summarySheet.addRow({ label: "Tienda", value: storeName });
      summarySheet.addRow({
        label: "Fecha de Sincronización",
        value: new Date(result.syncLog.createdAt).toLocaleString("es-ES"),
      });
      summarySheet.addRow({
        label: "Tipo de Sincronización",
        value: result.syncLog.syncType,
      });
      summarySheet.addRow({ label: "Estado", value: result.syncLog.status });
      summarySheet.addRow({
        label: "Productos Exitosos",
        value: result.syncLog.syncedCount,
      });
      summarySheet.addRow({
        label: "Productos con Error",
        value: result.syncLog.errorCount,
      });
      summarySheet.addRow({
        label: "Total Productos",
        value: result.items.length,
      });
      summarySheet.addRow({
        label: "Duración (ms)",
        value: result.syncLog.durationMs || "N/A",
      });

      // Generar nombre de archivo
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `sync-log-${id}-${timestamp}.xlsx`;

      // Configurar headers para descarga
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Escribir el archivo al response
      await workbook.xlsx.write(res);
      res.end();

      console.log(`[API] Excel exportado exitosamente: ${filename}`);
    } catch (error: any) {
      console.error("[API] Error exportando a Excel:", error);
      res.status(500).json({
        message: "Error al exportar a Excel",
        error: error.message,
      });
    }
  });

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // Get notifications for the current tenant
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const limit = parseInt(req.query.limit as string) || 50;

      const notifications = await storage.getNotificationsByTenant(
        user.tenantId,
        limit
      );

      const unreadCount = await storage.getUnreadNotificationsCount(
        user.tenantId
      );

      res.json({
        notifications,
        unreadCount,
      });
    } catch (error: any) {
      console.error("Error obteniendo notificaciones:", error);
      res.status(500).json({
        message: "Error al obtener notificaciones",
        error: error.message,
      });
    }
  });

  // Mark a notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;

      // Verify notification belongs to tenant before updating
      const notifications = await storage.getNotificationsByTenant(
        user.tenantId,
        1000
      );
      const notification = notifications.find((n) => n.id === parseInt(id));

      if (!notification) {
        return res.status(404).json({ message: "Notificación no encontrada" });
      }

      const updated = await storage.markNotificationAsRead(parseInt(id));
      res.json({ notification: updated });
    } catch (error: any) {
      console.error("Error marcando notificación como leída:", error);
      res.status(500).json({
        message: "Error al marcar notificación",
        error: error.message,
      });
    }
  });

  // Mark all notifications as read for the current tenant
  app.patch("/api/notifications/mark-all-read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      await storage.markAllNotificationsAsRead(user.tenantId);
      res.json({ message: "Todas las notificaciones marcadas como leídas" });
    } catch (error: any) {
      console.error("Error marcando todas las notificaciones:", error);
      res.status(500).json({
        message: "Error al marcar notificaciones",
        error: error.message,
      });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autorizado" });
    }

    try {
      const user = (req as AuthenticatedRequest).user;
      const { id } = req.params;

      // Verify notification belongs to tenant before deleting
      const notifications = await storage.getNotificationsByTenant(
        user.tenantId,
        1000
      );
      const notification = notifications.find((n) => n.id === parseInt(id));

      if (!notification) {
        return res.status(404).json({ message: "Notificación no encontrada" });
      }

      await storage.deleteNotification(parseInt(id));
      res.json({ message: "Notificación eliminada" });
    } catch (error: any) {
      console.error("Error eliminando notificación:", error);
      res.status(500).json({
        message: "Error al eliminar notificación",
        error: error.message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
