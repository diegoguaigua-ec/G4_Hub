import { Router, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import {
  InventoryPushService,
  WebhookEventData,
} from "../services/inventoryPushService";

const router = Router();

/**
 * Verifica la firma HMAC de Shopify
 * @param req - Request object
 * @param secret - Shopify API Secret
 * @returns true si la firma es válida
 */
function verifyShopifyHMAC(req: Request, secret: string): boolean {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];

  if (!hmacHeader || typeof hmacHeader !== "string") {
    return false;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.error("[Webhook] No se encontró rawBody para validación HMAC");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return hmacHeader === hash;
}

/**
 * Verifica la firma de WooCommerce
 * @param req - Request object
 * @param secret - WooCommerce Webhook Secret
 * @returns true si la firma es válida
 */
function verifyWooCommerceSignature(req: Request, secret: string): boolean {
  const signature = req.headers["x-wc-webhook-signature"];

  if (!signature || typeof signature !== "string") {
    return false;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.error("[Webhook] No se encontró rawBody para validación de firma");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return signature === hash;
}

/**
 * Extrae line items de un webhook de Shopify
 * @param payload - Payload del webhook
 * @returns Array de line items
 */
function extractShopifyLineItems(payload: any): {
  sku: string;
  quantity: number;
  productName?: string;
}[] {
  const lineItems = payload.line_items || [];

  return lineItems
    .map((item: any) => ({
      sku: item.sku || item.variant_id?.toString(),
      quantity: item.quantity || 1,
      productName: item.name || item.title,
    }))
    .filter((item: any) => item.sku); // Solo items con SKU
}

/**
 * Extrae line items de un webhook de WooCommerce
 * @param payload - Payload del webhook
 * @returns Array de line items
 */
function extractWooCommerceLineItems(payload: any): {
  sku: string;
  quantity: number;
  productName?: string;
}[] {
  const lineItems = payload.line_items || [];

  return lineItems
    .map((item: any) => ({
      sku: item.sku,
      quantity: item.quantity || 1,
      productName: item.name,
    }))
    .filter((item: any) => item.sku); // Solo items con SKU
}

/**
 * Webhook endpoint para Shopify
 * Eventos soportados:
 * - orders/paid: Orden pagada (egreso)
 * - orders/cancelled: Orden cancelada (ingreso)
 * - refunds/create: Reembolso creado (ingreso)
 */
router.post("/shopify/:storeId", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const topic = req.headers["x-shopify-topic"] as string;

    console.log(`[Webhook][Shopify] 🔔 Recibido evento: ${topic} para tienda ${storeId}`);
    console.log(`[Webhook][Shopify] Headers:`, {
      topic: req.headers["x-shopify-topic"],
      shop: req.headers["x-shopify-shop-domain"],
      hmac: req.headers["x-shopify-hmac-sha256"] ? "presente" : "ausente"
    });

    // Validar que sea un evento soportado
    // Eventos soportados para procesamiento de inventario
    // NOTA: inventory_levels/update NO se soporta intencionalmente para evitar duplicados
    // - Las órdenes actualizan el inventario vía orders/paid (para egresos) y orders/cancelled (para ingresos)
    // - inventory_levels/update podría causar doble conteo si se procesa junto con eventos de órdenes
    // - Para soportar en el futuro: implementar sistema de deltas con snapshots de stock por ubicación
    const supportedEvents = ["orders/paid", "orders/cancelled", "refunds/create"];
    const ignoredEvents = ["orders/create", "orders/updated"]; // Ignorados para evitar duplicados

    if (!supportedEvents.includes(topic)) {
      // Logging estructurado para eventos no soportados (telemetría)
      if (ignoredEvents.includes(topic)) {
        console.log(`[Webhook][Shopify] ℹ️ ${topic} recibido pero ignorado (solo orders/paid genera egresos para evitar duplicados)`);
      } else if (topic === "inventory_levels/update") {
        console.log(`[Webhook][Shopify] ℹ️ inventory_levels/update recibido pero ignorado (evita duplicados con orders/*)`);
      } else {
        console.log(`[Webhook][Shopify] ⚠️ Evento ${topic} no reconocido, ignorando`);
      }
      return res.status(200).json({ message: "Event not supported, ignored" });
    }

    // Obtener la tienda
    const store = await storage.getStore(parseInt(storeId));
    if (!store) {
      console.error(`[Webhook][Shopify] Tienda ${storeId} no encontrada`);
      return res.status(404).json({ error: "Store not found" });
    }

    // Verificar HMAC
    const apiSecret = (store.apiCredentials as any)?.api_secret;
    if (!apiSecret) {
      console.error(`[Webhook][Shopify] ⚠️ API Secret no configurado para tienda ${storeId}`);
      console.error(`[Webhook][Shopify] ⚠️ Credenciales actuales:`, Object.keys(store.apiCredentials || {}));
      console.error(`[Webhook][Shopify] ⚠️ Se requiere api_secret para validar webhooks de Shopify`);
      return res.status(400).json({
        error: "API Secret not configured",
        hint: "Add api_secret to store credentials"
      });
    }

    if (!verifyShopifyHMAC(req, apiSecret)) {
      console.error(`[Webhook][Shopify] ❌ HMAC inválido para tienda ${storeId}`);
      return res.status(401).json({ error: "Invalid HMAC signature" });
    }

    console.log(`[Webhook][Shopify] ✅ HMAC válido`);

    // Obtener integración de Contífico
    const storeIntegrations = await storage.getStoreIntegrations(store.id);
    const contificoIntegration = storeIntegrations.find(
      (si) => si.integration?.integrationType === "contifico",
    );

    if (!contificoIntegration) {
      console.error(
        `[Webhook][Shopify] No se encontró integración de Contífico para tienda ${storeId}`,
      );
      return res
        .status(400)
        .json({ error: "Contífico integration not configured" });
    }

    // Extraer datos del payload
    const payload = req.body;
    const orderId = payload.id?.toString() || payload.order_id?.toString();

    if (!orderId) {
      console.error(`[Webhook][Shopify] No se encontró ID de orden en el payload`);
      return res.status(400).json({ error: "Order ID not found in payload" });
    }

    // Extraer line items
    const lineItems = extractShopifyLineItems(payload);

    if (lineItems.length === 0) {
      console.log(
        `[Webhook][Shopify] No se encontraron items con SKU en orden ${orderId}`,
      );
      return res
        .status(200)
        .json({ message: "No items with SKU found, ignored" });
    }

    // Crear datos del evento
    const eventData: WebhookEventData = {
      storeId: store.id,
      integrationId: contificoIntegration.integrationId,
      tenantId: store.tenantId,
      orderId,
      eventType: topic,
      lineItems,
      metadata: {
        shopifyOrderNumber: payload.order_number,
        shopifyOrderName: payload.name,
        customerEmail: payload.email,
      },
    };

    // Encolar movimientos
    const queuedCount =
      await InventoryPushService.queueMovementsFromWebhook(eventData);

    console.log(
      `[Webhook][Shopify] ✅ ${queuedCount} movimientos encolados para orden ${orderId}`,
    );

    return res.status(200).json({
      success: true,
      queued: queuedCount,
      orderId,
    });
  } catch (error: any) {
    console.error(`[Webhook][Shopify] Error procesando webhook:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Webhook endpoint para WooCommerce
 * Eventos soportados:
 * - order.completed: Orden completada (egreso)
 * - order.cancelled: Orden cancelada (ingreso)
 * - order.refunded: Orden reembolsada (ingreso)
 */
router.post("/woocommerce/:storeId", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const event = req.headers["x-wc-webhook-event"] as string;

    console.log(
      `[Webhook][WooCommerce] Recibido evento: ${event} para tienda ${storeId}`,
    );

    // Validar que sea un evento soportado
    const supportedEvents = [
      "order.completed",
      "order.cancelled",
      "order.refunded",
    ];
    if (!supportedEvents.includes(event)) {
      console.log(
        `[Webhook][WooCommerce] Evento ${event} no soportado, ignorando`,
      );
      return res.status(200).json({ message: "Event not supported, ignored" });
    }

    // Obtener la tienda
    const store = await storage.getStore(parseInt(storeId));
    if (!store) {
      console.error(`[Webhook][WooCommerce] Tienda ${storeId} no encontrada`);
      return res.status(404).json({ error: "Store not found" });
    }

    // Verificar firma
    const webhookSecret = (store.apiCredentials as any)?.webhook_secret;
    if (!webhookSecret) {
      console.error(
        `[Webhook][WooCommerce] Webhook Secret no configurado para tienda ${storeId}`,
      );
      return res.status(400).json({ error: "Webhook Secret not configured" });
    }

    if (!verifyWooCommerceSignature(req, webhookSecret)) {
      console.error(
        `[Webhook][WooCommerce] Firma inválida para tienda ${storeId}`,
      );
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    console.log(`[Webhook][WooCommerce] ✅ Firma válida`);

    // Obtener integración de Contífico
    const storeIntegrations = await storage.getStoreIntegrations(store.id);
    const contificoIntegration = storeIntegrations.find(
      (si) => si.integration?.integrationType === "contifico",
    );

    if (!contificoIntegration) {
      console.error(
        `[Webhook][WooCommerce] No se encontró integración de Contífico para tienda ${storeId}`,
      );
      return res
        .status(400)
        .json({ error: "Contífico integration not configured" });
    }

    // Extraer datos del payload
    const payload = req.body;
    const orderId = payload.id?.toString() || payload.number?.toString();

    if (!orderId) {
      console.error(
        `[Webhook][WooCommerce] No se encontró ID de orden en el payload`,
      );
      return res.status(400).json({ error: "Order ID not found in payload" });
    }

    // Extraer line items
    const lineItems = extractWooCommerceLineItems(payload);

    if (lineItems.length === 0) {
      console.log(
        `[Webhook][WooCommerce] No se encontraron items con SKU en orden ${orderId}`,
      );
      return res
        .status(200)
        .json({ message: "No items with SKU found, ignored" });
    }

    // Crear datos del evento
    const eventData: WebhookEventData = {
      storeId: store.id,
      integrationId: contificoIntegration.integrationId,
      tenantId: store.tenantId,
      orderId,
      eventType: event,
      lineItems,
      metadata: {
        wooOrderNumber: payload.number,
        customerEmail: payload.billing?.email,
        status: payload.status,
      },
    };

    // Encolar movimientos
    const queuedCount =
      await InventoryPushService.queueMovementsFromWebhook(eventData);

    console.log(
      `[Webhook][WooCommerce] ✅ ${queuedCount} movimientos encolados para orden ${orderId}`,
    );

    return res.status(200).json({
      success: true,
      queued: queuedCount,
      orderId,
    });
  } catch (error: any) {
    console.error(
      `[Webhook][WooCommerce] Error procesando webhook:`,
      error.message,
    );
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint de salud para verificar que el servicio de webhooks está activo
 */
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Endpoint de prueba para Shopify (SOLO DESARROLLO - sin validación HMAC)
 * Permite probar el flujo de webhooks sin configurar Shopify
 */
router.post("/shopify/:storeId/test", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const topic = "orders/paid"; // Siempre simula orden pagada

    console.log(`[Webhook][Test] 🧪 Prueba de webhook para tienda ${storeId}`);

    // Obtener la tienda
    const store = await storage.getStore(parseInt(storeId));
    if (!store) {
      console.error(`[Webhook][Test] Tienda ${storeId} no encontrada`);
      return res.status(404).json({ error: "Store not found" });
    }

    // Obtener integración de Contífico
    const storeIntegrations = await storage.getStoreIntegrations(store.id);
    console.log(`[Webhook][Test] Integraciones encontradas:`, storeIntegrations.length);
    console.log(`[Webhook][Test] Estructura:`, JSON.stringify(storeIntegrations, null, 2));

    const contificoIntegration = storeIntegrations.find(
      (si) => si.integration?.integrationType === "contifico",
    );

    if (!contificoIntegration) {
      console.error(
        `[Webhook][Test] No se encontró integración de Contífico para tienda ${storeId}`,
      );
      console.error(`[Webhook][Test] Integraciones disponibles:`, storeIntegrations.map(si => ({
        id: si.id,
        integrationId: si.integrationId,
        integrationType: si.integration?.integrationType,
        hasIntegration: !!si.integration
      })));
      return res
        .status(400)
        .json({ error: "Contífico integration not configured" });
    }

    // Usar payload del request o usar uno por defecto
    const payload = req.body.line_items
      ? req.body
      : {
          id: Date.now(),
          order_number: 9999,
          name: "#TEST-9999",
          email: "test@example.com",
          line_items: [
            {
              id: 111111,
              variant_id: 222222,
              sku: "TEST-SKU",
              name: "Producto de Prueba",
              title: "Producto de Prueba",
              quantity: 1,
            },
          ],
        };

    const orderId = payload.id?.toString();

    // Extraer line items
    const lineItems = extractShopifyLineItems(payload);

    if (lineItems.length === 0) {
      console.log(`[Webhook][Test] No se encontraron items con SKU`);
      return res
        .status(200)
        .json({ message: "No items with SKU found, ignored" });
    }

    // Crear datos del evento
    const eventData: WebhookEventData = {
      storeId: store.id,
      integrationId: contificoIntegration.integrationId,
      tenantId: store.tenantId,
      orderId,
      eventType: topic,
      lineItems,
      metadata: {
        shopifyOrderNumber: payload.order_number,
        shopifyOrderName: payload.name,
        customerEmail: payload.email,
        testMode: true,
      },
    };

    // Encolar movimientos
    const queuedCount =
      await InventoryPushService.queueMovementsFromWebhook(eventData);

    console.log(
      `[Webhook][Test] ✅ ${queuedCount} movimientos encolados para orden de prueba ${orderId}`,
    );

    return res.status(200).json({
      success: true,
      queued: queuedCount,
      orderId,
      message: "Test webhook processed successfully",
      lineItems,
    });
  } catch (error: any) {
    console.error(`[Webhook][Test] Error procesando webhook de prueba:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
