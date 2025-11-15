import {
  BaseConnector,
  ConnectionResult,
  ProductsResult,
  ProductResult,
  UpdateResult,
  StoreInfoResult,
  StandardProduct,
} from "./BaseConnector";
import axios, { AxiosRequestConfig } from "axios";
import { Store } from "@shared/schema";

interface ShopifyCredentials {
  access_token: string;
  api_version?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  vendor: string;
  tags: string;
  status: "active" | "archived" | "draft";
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
  [key: string]: any;
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string | null;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  [key: string]: any;
}

interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  province: string | null;
  country: string;
  address1: string | null;
  zip: string | null;
  city: string | null;
  source: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_locale: string;
  address2: string | null;
  created_at: string;
  updated_at: string;
  country_code: string;
  country_name: string;
  currency: string;
  customer_email: string | null;
  timezone: string;
  iana_timezone: string;
  shop_owner: string;
  money_format: string;
  money_with_currency_format: string;
  weight_unit: string;
  province_code: string | null;
  taxes_included: boolean | null;
  auto_configure_tax_inclusivity: boolean | null;
  tax_shipping: boolean | null;
  county_taxes: boolean | null;
  plan_display_name: string;
  plan_name: string;
  has_discounts: boolean;
  has_gift_cards: boolean;
  myshopify_domain: string;
  google_apps_domain: string | null;
  google_apps_login_enabled: boolean | null;
  money_in_emails_format: string;
  money_with_currency_in_emails_format: string;
  eligible_for_payments: boolean;
  requires_extra_payments_agreement: boolean;
  password_enabled: boolean;
  has_storefront: boolean;
  finances: boolean;
  primary_location_id: number;
  cookie_consent_level: string;
  visitor_tracking_consent_preference: string;
  checkout_api_supported: boolean;
  multi_location_enabled: boolean;
  setup_required: boolean;
  pre_launch_enabled: boolean;
  enabled_presentment_currencies: string[];
  [key: string]: any;
}

/**
 * Shopify connector implementing the BaseConnector interface
 * Handles authentication, product management, and data transformation for Shopify stores
 *
 * NOTE: This implementation uses Shopify's REST API which is deprecated as of October 2024.
 * New apps must use GraphQL starting April 2025. Consider migrating to GraphQL Admin API
 * for production use: https://shopify.dev/docs/api/admin-graphql
 *
 * Current REST implementation follows cursor-based pagination via Link headers:
 * https://shopify.dev/docs/api/usage/pagination-rest
 */
export class ShopifyConnector extends BaseConnector {
  private shopifyCredentials: ShopifyCredentials;
  private apiVersion: string;
  private shopDomain: string;

  constructor(store: Store) {
    super(store);
    this.validateShopifyCredentials();
    this.shopifyCredentials = store.apiCredentials as ShopifyCredentials;
    this.apiVersion = this.shopifyCredentials.api_version || "2024-10";

    // Extraer shop domain del storeUrl (ej: "https://myshop.myshopify.com" → "myshop.myshopify.com")
    try {
      const url = new URL(this.baseUrl);
      this.shopDomain = url.hostname;
    } catch (error) {
      console.warn(`[Shopify] Error parsing storeUrl: ${this.baseUrl}`);
      this.shopDomain = this.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  }

  // Getter para apiUrl usado en métodos de webhooks
  private get apiUrl(): string {
    return `${this.baseUrl}/admin/api/${this.apiVersion}`;
  }

  // Getter para headers usado en métodos de webhooks
  private get headers(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.shopifyCredentials.access_token,
      'Content-Type': 'application/json'
    };
  }

  protected authenticateRequest(
    config: AxiosRequestConfig,
  ): AxiosRequestConfig {
    // Shopify uses Bearer token authentication
    const headers: any = { ...(config.headers || {}) };
    headers["X-Shopify-Access-Token"] = this.shopifyCredentials.access_token;

    return {
      ...config,
      headers,
    };
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      console.log(`[Shopify] Testing connection to ${this.baseUrl}`);

      const response = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/shop.json`,
      );
      const shopData: { shop: ShopifyShop } = response.data;
      const shop = shopData.shop;

      // Get product count
      const productsCountResponse = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/count.json`,
      );
      const productsCount = productsCountResponse.data.count;

      return {
        success: true,
        store_name: shop.name,
        domain: shop.domain,
        products_count: productsCount,
        details: {
          shop_id: shop.id,
          myshopify_domain: shop.myshopify_domain,
          currency: shop.currency,
          timezone: shop.timezone,
          plan: shop.plan_display_name,
          country: shop.country_name,
          api_version: this.apiVersion,
          has_storefront: shop.has_storefront,
          eligible_for_payments: shop.eligible_for_payments,
        },
      };
    } catch (error: any) {
      console.error(`[Shopify] Connection test failed:`, error.message);

      let errorMessage = "Failed to connect to Shopify store";

      if (error.status === 401 || error.status === 403) {
        errorMessage =
          "Invalid access token. Please check your Shopify private app credentials.";
      } else if (error.status === 404) {
        errorMessage =
          "Shopify Admin API not found. Please ensure the store URL is correct.";
      } else if (error.code === "NETWORK_ERROR") {
        errorMessage =
          "Unable to connect to store. Please check the store URL.";
      } else if (error.status === 429) {
        errorMessage = "Rate limited by Shopify. Please try again later.";
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          original_error: error.message,
          status: error.status,
          code: error.code,
        },
      };
    }
  }

  async getProducts(
    page: number = 1,
    limit: number = 10,
    pageInfo?: string,
  ): Promise<ProductsResult> {
    try {
      console.log(
        `[Shopify] Fetching products limit ${limit}, pageInfo: ${pageInfo || "first page"}`,
      );

      const params: any = {
        limit: Math.min(limit, 250), // Shopify max is 250
        status: "active",
        fields:
          "id,title,handle,product_type,vendor,created_at,updated_at,status,variants,images",
      };

      // Use cursor-based pagination with page_info if provided
      if (pageInfo) {
        params.page_info = pageInfo;
      }

      const response = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products.json`,
        null,
        {
          params,
        },
      );

      const products: ShopifyProduct[] = response.data.products;

      // Parse Link header for pagination info following Shopify's pagination documentation
      // https://shopify.dev/docs/api/usage/pagination-rest
      const linkHeader = response.headers.link || "";
      let hasNext = false;
      let nextPageInfo: string | undefined;
      let prevPageInfo: string | undefined;

      if (linkHeader) {
        // Split by commas and process each link
        const links = linkHeader.split(",").map((link: string) => link.trim());

        // Find next link
        const nextLink = links.find((link: string) =>
          link.includes('rel="next"'),
        );
        if (nextLink) {
          hasNext = true;
          const urlMatch = nextLink.match(/<([^>]+)>/);
          if (urlMatch) {
            const url = urlMatch[1];
            const pageInfoMatch = url.match(/page_info=([^&]+)/);
            if (pageInfoMatch) {
              nextPageInfo = decodeURIComponent(pageInfoMatch[1]);
            }
          }
        }

        // Find previous link for bidirectional navigation
        const prevLink = links.find((link: string) =>
          link.includes('rel="previous"'),
        );
        if (prevLink) {
          const urlMatch = prevLink.match(/<([^>]+)>/);
          if (urlMatch) {
            const url = urlMatch[1];
            const pageInfoMatch = url.match(/page_info=([^&]+)/);
            if (pageInfoMatch) {
              prevPageInfo = decodeURIComponent(pageInfoMatch[1]);
            }
          }
        }
      }

      // Get total count for pagination info
      const countResponse = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/count.json`,
        null,
        {
          params: { status: "active" },
        },
      );

      const totalItems = countResponse.data.count;

      return {
        products: products.map((product) => this.transformProduct(product)),
        pagination: {
          current_page: pageInfo ? 1 : page, // Cursor pagination doesn't use numeric pages
          total_items: totalItems,
          has_next: hasNext,
          next_cursor: nextPageInfo,
          prev_cursor: prevPageInfo,
        },
      };
    } catch (error: any) {
      console.error(`[Shopify] Failed to fetch products:`, error.message);
      throw error;
    }
  }

  async getProduct(productId: string): Promise<ProductResult> {
    try {
      console.log(`[Shopify] Fetching product ${productId}`);

      const response = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/${productId}.json`,
      );
      const productData: { product: ShopifyProduct } = response.data;

      return {
        product: this.transformProduct(productData.product),
      };
    } catch (error: any) {
      console.error(
        `[Shopify] Failed to fetch product ${productId}:`,
        error.message,
      );
      throw error;
    }
  }

  async updateProduct(
    productId: string,
    data: Partial<StandardProduct>,
  ): Promise<UpdateResult> {
    try {
      console.log(`[Shopify] Updating product ${productId}`);

      // First, get the current product to access variant IDs
      const currentProductResponse = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/${productId}.json`,
      );
      const currentProduct: ShopifyProduct =
        currentProductResponse.data.product;
      const mainVariant = currentProduct.variants[0];

      if (!mainVariant) {
        throw new Error(`Product ${productId} has no variants to update`);
      }

      // Update product-level fields
      const productUpdates: any = { id: parseInt(productId) };
      let hasProductChanges = false;

      if (data.name !== undefined) {
        productUpdates.title = data.name;
        hasProductChanges = true;
      }

      // Update variant-level fields (price, SKU)
      const variantUpdates: any = { id: mainVariant.id };
      let hasVariantChanges = false;

      if (data.sku !== undefined) {
        variantUpdates.sku = data.sku;
        hasVariantChanges = true;
      }
      if (data.price !== undefined) {
        variantUpdates.price = (data.price / 100).toFixed(2);
        hasVariantChanges = true;
      }

      // Handle inventory management setting
      if (data.manage_stock !== undefined) {
        variantUpdates.inventory_management = data.manage_stock
          ? "shopify"
          : null;
        hasVariantChanges = true;
      }

      let productUpdateResponse;

      // Only update product if there are actual product-level changes beyond ID
      if (hasProductChanges) {
        productUpdateResponse = await this.makeRequest(
          "PUT",
          `/admin/api/${this.apiVersion}/products/${productId}.json`,
          {
            product: productUpdates,
          },
        );
      }

      // Only update variant if there are actual variant-level changes beyond ID
      if (hasVariantChanges) {
        await this.makeRequest(
          "PUT",
          `/admin/api/${this.apiVersion}/variants/${mainVariant.id}.json`,
          {
            variant: variantUpdates,
          },
        );
      }

      // Handle inventory quantity updates using modern Shopify approach
      let inventoryUpdateSuccess = true;
      let inventoryUpdateMessage: string | undefined = undefined;

      if (data.stock_quantity !== undefined && data.manage_stock !== false) {
        try {
          let locationId: number | null = null;

          // Try to get existing inventory level to find location
          const inventoryResponse = await this.makeRequest(
            "GET",
            `/admin/api/${this.apiVersion}/inventory_levels.json`,
            null,
            {
              params: { inventory_item_ids: mainVariant.inventory_item_id },
            },
          );

          if (
            inventoryResponse.data.inventory_levels &&
            inventoryResponse.data.inventory_levels.length > 0
          ) {
            // Use existing location
            locationId = inventoryResponse.data.inventory_levels[0].location_id;
          } else {
            // No inventory levels exist, get primary location from shop
            const shopResponse = await this.makeRequest(
              "GET",
              `/admin/api/${this.apiVersion}/shop.json`,
            );
            locationId = shopResponse.data.shop.primary_location_id;

            if (locationId) {
              // Connect inventory item to primary location first
              await this.makeRequest(
                "POST",
                `/admin/api/${this.apiVersion}/inventory_levels/connect.json`,
                {
                  location_id: locationId,
                  inventory_item_id: mainVariant.inventory_item_id,
                },
              );
            }
          }

          if (locationId) {
            try {
              // Set inventory quantity at location
              await this.makeRequest(
                "POST",
                `/admin/api/${this.apiVersion}/inventory_levels/set.json`,
                {
                  location_id: locationId,
                  inventory_item_id: mainVariant.inventory_item_id,
                  available: data.stock_quantity,
                },
              );
            } catch (setError: any) {
              // If set fails due to tracking not enabled, enable tracking and retry
              if (
                setError.message?.includes("422") ||
                setError.message?.includes("inventory")
              ) {
                console.log(
                  `[Shopify] Enabling inventory tracking for variant ${mainVariant.id} and retrying stock update`,
                );

                // Enable inventory tracking
                await this.makeRequest(
                  "PUT",
                  `/admin/api/${this.apiVersion}/variants/${mainVariant.id}.json`,
                  {
                    variant: {
                      id: mainVariant.id,
                      inventory_management: "shopify",
                    },
                  },
                );

                // Retry inventory set
                await this.makeRequest(
                  "POST",
                  `/admin/api/${this.apiVersion}/inventory_levels/set.json`,
                  {
                    location_id: locationId,
                    inventory_item_id: mainVariant.inventory_item_id,
                    available: data.stock_quantity,
                  },
                );

                inventoryUpdateMessage = `Enabled inventory tracking and set quantity to ${data.stock_quantity}`;
              } else {
                throw setError;
              }
            }
          } else {
            inventoryUpdateSuccess = false;
            inventoryUpdateMessage =
              "No location available for inventory update";
            console.warn(
              `[Shopify] No location available for inventory update on product ${productId}`,
            );
          }
        } catch (inventoryError: any) {
          inventoryUpdateSuccess = false;
          inventoryUpdateMessage = `Failed to update inventory: ${inventoryError.message}`;
          console.warn(
            `[Shopify] Failed to update inventory for product ${productId}:`,
            inventoryError.message,
          );
          // Don't fail the entire update if inventory update fails
        }
      }

      // Get the updated product
      const finalProductResponse = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/${productId}.json`,
      );
      const updatedProduct: ShopifyProduct = finalProductResponse.data.product;

      return {
        success: true,
        product: this.transformProduct(updatedProduct),
        inventory_status: inventoryUpdateSuccess
          ? "success"
          : "partial_failure",
        inventory_message: inventoryUpdateMessage,
      };
    } catch (error: any) {
      console.error(
        `[Shopify] Failed to update product ${productId}:`,
        error.message,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getStoreInfo(): Promise<StoreInfoResult> {
    try {
      console.log(`[Shopify] Fetching store information`);

      const response = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/shop.json`,
      );
      const shopData: { shop: ShopifyShop } = response.data;
      const shop = shopData.shop;

      // Get product count
      const productsCountResponse = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/count.json`,
      );
      const productsCount = productsCountResponse.data.count;

      return {
        name: shop.name,
        domain: shop.domain,
        currency: shop.currency,
        timezone: shop.timezone,
        version: this.apiVersion,
        products_count: productsCount,
        raw_data: shop,
      };
    } catch (error: any) {
      console.error(`[Shopify] Failed to fetch store info:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene todos los productos con SKU de la tienda
   * Similar a stci_get_all_products_with_sku del WordPress Plugin
   */
  async getProductsWithSku(): Promise<
    Array<{
      sku: string;
      variant_id: number;
      product_id: number;
      inventory_quantity: number;
      title: string;
      inventory_item_id: number;
    }>
  > {
    const productsWithSku: any[] = [];
    let hasNextPage = true;
    let pageInfo: string | null = null;

    console.log("[Shopify] Obteniendo todos los productos con SKU...");

    while (hasNextPage) {
      try {
        // Construir URL con paginación
        let url = `/admin/api/${this.apiVersion}/products.json?limit=250`;
        if (pageInfo) {
          url += `&page_info=${pageInfo}`;
        }

        const response = await this.makeRequest("GET", url);
        const products: ShopifyProduct[] = response.data.products;

        // Extraer información de paginación del header Link
        const linkHeader = response.headers?.link || "";
        const nextPageMatch = linkHeader.match(
          /<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/,
        );
        hasNextPage = !!nextPageMatch;
        pageInfo = nextPageMatch ? nextPageMatch[1] : null;

        // Procesar cada producto y sus variantes
        for (const product of products) {
          for (const variant of product.variants) {
            // Solo incluir variantes que TIENEN SKU
            if (variant.sku && variant.sku.trim() !== "") {
              productsWithSku.push({
                sku: variant.sku.trim(),
                variant_id: variant.id,
                product_id: product.id,
                inventory_quantity: variant.inventory_quantity || 0,
                inventory_item_id: variant.inventory_item_id || 0,
                title: `${product.title}${variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`,
              });
            }
          }
        }

        console.log(
          `[Shopify] Procesados ${products.length} productos. Total con SKU: ${productsWithSku.length}`,
        );
      } catch (error: any) {
        console.error(
          "[Shopify] Error obteniendo productos con SKU:",
          error.message,
        );
        throw error;
      }
    }

    console.log(
      `[Shopify] Total de productos con SKU: ${productsWithSku.length}`,
    );
    return productsWithSku;
  }

  /**
   * Actualiza el stock de una variante específica
   */
  async updateVariantStock(
    variantId: number,
    inventoryItemId: number,
    quantity: number,
  ): Promise<boolean> {
    try {
      console.log(
        `[Shopify] Actualizando stock de variante ${variantId} (inventory_item: ${inventoryItemId}) a ${quantity} unidades`,
      );

      // 1. Obtener el location_id (usar el primero disponible)
      let locationId: number | null = null;

      try {
        // Intentar obtener inventory levels existentes para este item
        const inventoryResponse = await this.makeRequest(
          "GET",
          `/admin/api/${this.apiVersion}/inventory_levels.json`,
          null,
          { params: { inventory_item_ids: inventoryItemId } },
        );

        if (
          inventoryResponse.data.inventory_levels &&
          inventoryResponse.data.inventory_levels.length > 0
        ) {
          // Usar la primera ubicación disponible
          locationId = inventoryResponse.data.inventory_levels[0].location_id;
          console.log(`[Shopify] Usando location_id existente: ${locationId}`);
        }
      } catch (error: any) {
        console.warn(
          `[Shopify] No se pudo obtener inventory_levels, obteniendo location principal`,
        );
      }

      // 2. Si no hay location, obtener el location principal de la tienda
      if (!locationId) {
        const shopResponse = await this.makeRequest(
          "GET",
          `/admin/api/${this.apiVersion}/shop.json`,
        );
        locationId = shopResponse.data.shop.primary_location_id;
        console.log(`[Shopify] Usando primary_location_id: ${locationId}`);

        if (!locationId) {
          throw new Error(
            "No se pudo obtener location_id para actualizar inventario",
          );
        }

        // Conectar inventory item a esta ubicación
        try {
          await this.makeRequest(
            "POST",
            `/admin/api/${this.apiVersion}/inventory_levels/connect.json`,
            {
              location_id: locationId,
              inventory_item_id: inventoryItemId,
            },
          );
          console.log(
            `[Shopify] Inventory item ${inventoryItemId} conectado a location ${locationId}`,
          );
        } catch (connectError: any) {
          // Si ya está conectado, ignorar el error
          if (!connectError.message?.includes("422")) {
            throw connectError;
          }
        }
      }

      // 3. Actualizar cantidad de inventario usando /inventory_levels/set.json
      await this.makeRequest(
        "POST",
        `/admin/api/${this.apiVersion}/inventory_levels/set.json`,
        {
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: quantity,
        },
      );

      console.log(
        `[Shopify] ✅ Stock actualizado exitosamente a ${quantity} unidades`,
      );
      return true;
    } catch (error: any) {
      console.error(
        `[Shopify] Error actualizando stock de variante ${variantId}:`,
        error,
      );
      throw new Error(`Error al actualizar stock en Shopify: ${error.message}`);
    }
  }

  /**
   * Transform Shopify product to StandardProduct format
   * Uses the first variant for main product data
   */
  private transformProduct(shopifyProduct: ShopifyProduct): StandardProduct {
    // Use the first variant as the main variant (standard Shopify practice)
    const mainVariant = shopifyProduct.variants[0];

    if (!mainVariant) {
      throw new Error(`Product ${shopifyProduct.id} has no variants`);
    }

    // Convert price to cents
    const price = parseFloat(mainVariant.price) || 0;

    // Determine stock status
    let stockStatus: "in_stock" | "out_of_stock" | "on_backorder";
    if (mainVariant.inventory_quantity > 0) {
      stockStatus = "in_stock";
    } else if (mainVariant.inventory_policy === "continue") {
      stockStatus = "on_backorder";
    } else {
      stockStatus = "out_of_stock";
    }

    return {
      id: shopifyProduct.id.toString(),
      name: shopifyProduct.title,
      sku: mainVariant.sku || "",
      price: Math.round(price * 100), // Convert to cents
      stock_quantity: mainVariant.inventory_quantity,
      manage_stock: mainVariant.inventory_management !== null,
      stock_status: stockStatus,
      images: shopifyProduct.images.map((img) => img.src),
      platform: "shopify",
      raw_data: {
        product: shopifyProduct,
        main_variant: mainVariant,
      },
    };
  }

  /**
   * Transform StandardProduct data to Shopify format for updates
   * Note: Shopify updates are more complex due to variants structure
   */
  private transformToShopify(data: Partial<StandardProduct>): any {
    const shopifyData: any = {};

    if (data.name !== undefined) shopifyData.title = data.name;

    // For other fields, we need to update the main variant
    if (
      data.sku !== undefined ||
      data.price !== undefined ||
      data.stock_quantity !== undefined ||
      data.manage_stock !== undefined
    ) {
      shopifyData.variants = [{}];

      if (data.sku !== undefined) shopifyData.variants[0].sku = data.sku;
      if (data.price !== undefined) {
        // Convert from cents to price string
        shopifyData.variants[0].price = (data.price / 100).toFixed(2);
      }
      if (data.stock_quantity !== undefined) {
        shopifyData.variants[0].inventory_quantity = data.stock_quantity;
      }
      if (data.manage_stock !== undefined) {
        shopifyData.variants[0].inventory_management = data.manage_stock
          ? "shopify"
          : null;
      }
    }

    return shopifyData;
  }

  /**
   * Validate that required Shopify credentials are present
   */
  private validateShopifyCredentials(): void {
    this.validateCredentials(["access_token"]);

    if (!this.credentials?.access_token) {
      throw new Error("Shopify access token is required");
    }

    // Validate store URL format (should be myshopify.com domain)
    if (
      !this.baseUrl.includes(".myshopify.com") &&
      !this.baseUrl.includes("shopify.com")
    ) {
      console.warn(
        `[Shopify] Store URL ${this.baseUrl} doesn't appear to be a Shopify domain`,
      );
    }
  }

  /**
   * Get the products count for this store (used for dashboard stats)
   */
  async getProductsCount(): Promise<number> {
    try {
      const response = await this.makeRequest(
        "GET",
        `/admin/api/${this.apiVersion}/products/count.json`,
        null,
        {
          params: { status: "active" },
        },
      );

      return response.data.count || 0;
    } catch (error) {
      console.error(`[Shopify] Failed to get products count:`, error);
      return 0;
    }
  }

  /**
   * Registra webhooks automáticamente en Shopify
   * @param callbackUrl - URL pública donde Shopify enviará los webhooks
   * @returns Array de webhooks creados con sus IDs
   */
  async registerWebhooks(callbackUrl: string): Promise<{
    success: boolean;
    webhooks: Array<{ id: number; topic: string; address: string }>;
    errors: Array<{ topic: string; error: string }>;
  }> {
    const webhookTopics = [
      'orders/paid',
      'orders/cancelled',
      'refunds/create'
    ];

    const createdWebhooks: Array<{ id: number; topic: string; address: string }> = [];
    const errors: Array<{ topic: string; error: string }> = [];

    console.log(`[Shopify] Registrando webhooks para ${this.shopDomain}`);
    console.log(`[Shopify] URL de callback: ${callbackUrl}`);

    try {
      // Primero, obtener webhooks existentes para evitar duplicados
      const existingWebhooksResponse = await axios.get(
        `${this.apiUrl}/webhooks.json`,
        { headers: this.headers }
      );

      const existingWebhooks = existingWebhooksResponse.data.webhooks || [];
      console.log(`[Shopify] Webhooks existentes: ${existingWebhooks.length}`);

      for (const topic of webhookTopics) {
        try {
          // Verificar si ya existe un webhook para este topic y URL
          const existingWebhook = existingWebhooks.find(
            (wh: any) => wh.topic === topic && wh.address === callbackUrl
          );

          if (existingWebhook) {
            console.log(`[Shopify] ✓ Webhook ya existe: ${topic} → ID ${existingWebhook.id}`);
            createdWebhooks.push({
              id: existingWebhook.id,
              topic: topic,
              address: callbackUrl
            });
            continue;
          }

          // Crear nuevo webhook
          const response = await axios.post(
            `${this.apiUrl}/webhooks.json`,
            {
              webhook: {
                topic: topic,
                address: callbackUrl,
                format: 'json'
              }
            },
            { headers: this.headers }
          );

          if (response.data.webhook) {
            console.log(`[Shopify] ✅ Webhook creado: ${topic} → ID ${response.data.webhook.id}`);
            createdWebhooks.push({
              id: response.data.webhook.id,
              topic: topic,
              address: callbackUrl
            });
          }

        } catch (error: any) {
          const errorMsg = error.response?.data?.errors || error.message;
          console.error(`[Shopify] ❌ Error creando webhook ${topic}:`, errorMsg);
          errors.push({
            topic: topic,
            error: errorMsg
          });
        }
      }

      const success = createdWebhooks.length > 0 && errors.length === 0;
      console.log(`[Shopify] Resultado: ${createdWebhooks.length} webhooks configurados, ${errors.length} errores`);

      return {
        success,
        webhooks: createdWebhooks,
        errors
      };

    } catch (error: any) {
      console.error(`[Shopify] Error al registrar webhooks:`, error.message);
      return {
        success: false,
        webhooks: [],
        errors: [{ topic: 'general', error: error.message }]
      };
    }
  }

  /**
   * Elimina webhooks de Shopify
   * @param webhookIds - Array de IDs de webhooks a eliminar
   * @returns Cantidad de webhooks eliminados exitosamente
   */
  async deleteWebhooks(webhookIds: number[]): Promise<{
    success: boolean;
    deleted: number;
    errors: Array<{ id: number; error: string }>;
  }> {
    const errors: Array<{ id: number; error: string }> = [];
    let deleted = 0;

    console.log(`[Shopify] Eliminando ${webhookIds.length} webhooks`);

    for (const webhookId of webhookIds) {
      try {
        await axios.delete(
          `${this.apiUrl}/webhooks/${webhookId}.json`,
          { headers: this.headers }
        );
        deleted++;
        console.log(`[Shopify] ✅ Webhook ${webhookId} eliminado`);
      } catch (error: any) {
        const errorMsg = error.response?.data?.errors || error.message;
        console.error(`[Shopify] ❌ Error eliminando webhook ${webhookId}:`, errorMsg);
        errors.push({ id: webhookId, error: errorMsg });
      }
    }

    return {
      success: deleted > 0 && errors.length === 0,
      deleted,
      errors
    };
  }

  /**
   * Obtiene todos los webhooks configurados en Shopify
   * @returns Lista de webhooks con su información
   */
  async getWebhooks(): Promise<Array<{
    id: number;
    topic: string;
    address: string;
    createdAt: string;
  }>> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/webhooks.json`,
        { headers: this.headers }
      );

      const webhooks = response.data.webhooks || [];
      return webhooks.map((wh: any) => ({
        id: wh.id,
        topic: wh.topic,
        address: wh.address,
        createdAt: wh.created_at
      }));
    } catch (error: any) {
      console.error(`[Shopify] Error obteniendo webhooks:`, error.message);
      return [];
    }
  }
}
