import { BaseConnector, ConnectionResult, ProductsResult, ProductResult, UpdateResult, StoreInfoResult, StandardProduct } from './BaseConnector';
import { AxiosRequestConfig } from 'axios';
import { Store } from '@shared/schema';

interface WooCommerceCredentials {
  consumer_key: string;
  consumer_secret: string;
  api_version?: string;
}

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  images: Array<{
    id: number;
    src: string;
    alt: string;
  }>;
  status: string;
  type: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  [key: string]: any;
}

interface WooCommerceSystemStatus {
  environment: {
    home_url: string;
    site_url: string;
    version: string;
    wp_version: string;
    wp_multisite: boolean;
  };
  settings: {
    api_enabled: boolean;
    force_ssl: boolean;
    currency: string;
    currency_symbol: string;
    currency_position: string;
    thousand_separator: string;
    decimal_separator: string;
    number_of_decimals: number;
  };
  security: {
    secure_connection: boolean;
    hide_errors: boolean;
  };
  pages: any;
  post_type_counts?: {
    product?: number;
    [key: string]: number | undefined;
  };
}

/**
 * WooCommerce connector implementing the BaseConnector interface
 * Handles authentication, product management, and data transformation for WooCommerce stores
 */
export class WooCommerceConnector extends BaseConnector {
  private wooCredentials: WooCommerceCredentials;
  private apiVersion: string;

  constructor(store: Store) {
    super(store);
    this.validateWooCommerceCredentials();
    this.wooCredentials = store.apiCredentials as WooCommerceCredentials;
    this.apiVersion = this.wooCredentials.api_version || 'wc/v3';
  }

  protected authenticateRequest(config: AxiosRequestConfig): AxiosRequestConfig {
    // WooCommerce uses Basic Auth with Consumer Key and Secret
    const auth = Buffer.from(`${this.wooCredentials.consumer_key}:${this.wooCredentials.consumer_secret}`).toString('base64');
    
    // Ensure headers object exists and is mutable
    const headers: any = { ...config.headers };
    headers['Authorization'] = `Basic ${auth}`;
    
    return {
      ...config,
      headers
    };
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      console.log(`[WooCommerce] Testing connection to ${this.baseUrl}`);
      
      const response = await this.makeRequest('GET', '/wp-json/wc/v3/system_status');
      const systemStatus: WooCommerceSystemStatus = response.data;

      // Get product count
      const productsCountResponse = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
        params: { per_page: 1, status: 'publish' }
      });
      
      const totalProducts = parseInt(productsCountResponse.headers['x-wp-total'] || '0');

      // Extract store name from URL (fallback method)
      const storeName = new URL(this.baseUrl).hostname.replace('www.', '').split('.')[0] || 'WooCommerce Store';
      
      return {
        success: true,
        store_name: storeName,
        version: systemStatus.environment.version,
        products_count: totalProducts,
        details: {
          wc_version: systemStatus.environment.version,
          wp_version: systemStatus.environment.wp_version,
          currency: systemStatus.settings.currency,
          api_enabled: systemStatus.settings.api_enabled,
          force_ssl: systemStatus.settings.force_ssl,
          secure_connection: systemStatus.security.secure_connection
        }
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Connection test failed:`, error.message);
      
      let errorMessage = 'Failed to connect to WooCommerce store';
      
      if (error.status === 401 || error.status === 403) {
        errorMessage = 'Invalid Consumer Key or Consumer Secret. Please check your API credentials.';
      } else if (error.status === 404) {
        errorMessage = 'WooCommerce REST API not found. Please ensure WooCommerce is installed and REST API is enabled.';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Unable to connect to store. Please check the store URL.';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          original_error: error.message,
          status: error.status,
          code: error.code
        }
      };
    }
  }

  async getProducts(page: number = 1, limit: number = 10, pageInfo?: string): Promise<ProductsResult> {
    // WooCommerce uses traditional pagination, pageInfo is ignored
    try {
      console.log(`[WooCommerce] Fetching products page ${page}, limit ${limit}`);
      
      const response = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
        params: {
          page,
          per_page: limit,
          status: 'publish',
          orderby: 'date',
          order: 'desc'
        }
      });

      const products: WooCommerceProduct[] = response.data;
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      const totalItems = parseInt(response.headers['x-wp-total'] || '0');

      return {
        products: products.map(product => this.transformProduct(product)),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems
        }
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to fetch products:`, error.message);
      throw error;
    }
  }

  async getProduct(productId: string): Promise<ProductResult> {
    try {
      console.log(`[WooCommerce] Fetching product ${productId}`);
      
      const response = await this.makeRequest('GET', `/wp-json/wc/v3/products/${productId}`);
      const product: WooCommerceProduct = response.data;

      return {
        product: this.transformProduct(product)
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to fetch product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Busca un producto específicamente por SKU
   * Usa el parámetro de query ?sku= para buscar en WooCommerce
   */
  async getProductBySku(sku: string): Promise<ProductResult> {
    try {
      console.log(`[WooCommerce] Buscando producto por SKU: ${sku}`);
      
      const response = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
        params: { sku }
      });
      
      const products: WooCommerceProduct[] = response.data;
      
      if (!products || products.length === 0) {
        throw new Error(`Producto con SKU ${sku} no encontrado`);
      }
      
      return {
        product: this.transformProduct(products[0])
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to fetch product by SKU ${sku}:`, error.message);
      throw error;
    }
  }

  async updateProduct(productId: string, data: Partial<StandardProduct>): Promise<UpdateResult> {
    try {
      console.log(`[WooCommerce] Updating product ${productId}`);
      
      // Transform StandardProduct data to WooCommerce format
      const wooCommerceData = this.transformToWooCommerce(data);
      
      const response = await this.makeRequest('PUT', `/wp-json/wc/v3/products/${productId}`, wooCommerceData);
      const updatedProduct: WooCommerceProduct = response.data;

      return {
        success: true,
        product: this.transformProduct(updatedProduct)
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to update product ${productId}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStoreInfo(): Promise<StoreInfoResult> {
    try {
      console.log(`[WooCommerce] Fetching store information`);
      
      const response = await this.makeRequest('GET', '/wp-json/wc/v3/system_status');
      const systemStatus: WooCommerceSystemStatus = response.data;

      // Get product count
      const productsCountResponse = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
        params: { per_page: 1, status: 'publish' }
      });
      
      const totalProducts = parseInt(productsCountResponse.headers['x-wp-total'] || '0');

      // Extract store name from URL (fallback method)
      const storeName = new URL(this.baseUrl).hostname.replace('www.', '').split('.')[0] || 'WooCommerce Store';
      
      return {
        name: storeName,
        domain: this.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        currency: systemStatus.settings.currency,
        version: systemStatus.environment.version,
        products_count: totalProducts,
        raw_data: systemStatus
      };
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to fetch store info:`, error.message);
      throw error;
    }
  }

  /**
   * Obtiene todos los productos con SKU de WooCommerce
   */
  async getProductsWithSku(): Promise<Array<{
    sku: string;
    variant_id: number;
    product_id: number;
    inventory_quantity: number;
    title: string;
  }>> {
    const productsWithSku: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    console.log('[WooCommerce] Obteniendo todos los productos con SKU...');

    while (hasMore) {
      try {
        const response = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
          params: {
            per_page: perPage,
            page: page,
            status: 'publish'
          }
        });

        const products: WooCommerceProduct[] = response.data;

        for (const product of products) {
          // Productos simples
          if (product.type === 'simple' && product.sku && product.sku.trim() !== '') {
            productsWithSku.push({
              sku: product.sku.trim(),
              variant_id: product.id,
              product_id: product.id,
              inventory_quantity: product.stock_quantity || 0,
              title: product.name
            });
          }

          // Productos variables - obtener variaciones
          if (product.type === 'variable') {
            try {
              const variationsResponse = await this.makeRequest('GET', 
                `/wp-json/wc/v3/products/${product.id}/variations`, 
                null, 
                { params: { per_page: 100 } }
              );

              const variations = variationsResponse.data;

              for (const variation of variations) {
                if (variation.sku && variation.sku.trim() !== '') {
                  productsWithSku.push({
                    sku: variation.sku.trim(),
                    variant_id: variation.id,
                    product_id: product.id,
                    inventory_quantity: variation.stock_quantity || 0,
                    title: `${product.name} - ${variation.sku}`
                  });
                }
              }
            } catch (error) {
              console.error(`[WooCommerce] Error obteniendo variaciones del producto ${product.id}`);
            }
          }
        }

        // Verificar si hay más páginas
        hasMore = products.length === perPage;
        page++;

        console.log(`[WooCommerce] Página ${page - 1} procesada. Total con SKU: ${productsWithSku.length}`);

      } catch (error: any) {
        console.error('[WooCommerce] Error obteniendo productos con SKU:', error.message);
        throw error;
      }
    }

    console.log(`[WooCommerce] Total de productos con SKU: ${productsWithSku.length}`);
    return productsWithSku;
  }

  /**
   * Actualiza el stock de un producto específico
   */
  async updateProductStock(productId: number, quantity: number): Promise<boolean> {
    try {
      console.log(`[WooCommerce] Actualizando stock del producto ${productId} a ${quantity} unidades`);

      await this.makeRequest('PUT', `/wp-json/wc/v3/products/${productId}`, {
        manage_stock: true,
        stock_quantity: quantity
      });

      console.log(`[WooCommerce] ✅ Stock actualizado exitosamente`);
      return true;

    } catch (error: any) {
      console.error(`[WooCommerce] Error actualizando stock del producto ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Transform WooCommerce product to StandardProduct format
   */
  private transformProduct(wooProduct: WooCommerceProduct): StandardProduct {
    // Convert price to cents (multiply by 100 and round)
    const price = parseFloat(wooProduct.price) || 0;
    
    // Map WooCommerce stock status to standard format
    let stockStatus: 'in_stock' | 'out_of_stock' | 'on_backorder';
    switch (wooProduct.stock_status) {
      case 'instock':
        stockStatus = 'in_stock';
        break;
      case 'outofstock':
        stockStatus = 'out_of_stock';
        break;
      case 'onbackorder':
        stockStatus = 'on_backorder';
        break;
      default:
        stockStatus = 'out_of_stock';
    }

    return {
      id: wooProduct.id.toString(),
      name: wooProduct.name,
      sku: wooProduct.sku || '',
      price: Math.round(price * 100), // Convert to cents
      stock_quantity: wooProduct.stock_quantity ?? undefined,
      manage_stock: wooProduct.manage_stock,
      stock_status: stockStatus,
      images: wooProduct.images.map(img => img.src),
      platform: 'woocommerce',
      raw_data: wooProduct
    };
  }

  /**
   * Transform StandardProduct data to WooCommerce format for updates
   */
  private transformToWooCommerce(data: Partial<StandardProduct>): any {
    const wooData: any = {};

    if (data.name !== undefined) wooData.name = data.name;
    if (data.sku !== undefined) wooData.sku = data.sku;
    if (data.price !== undefined) {
      // Convert from cents to price string
      wooData.price = (data.price / 100).toFixed(2);
      wooData.regular_price = (data.price / 100).toFixed(2);
    }
    if (data.stock_quantity !== undefined) wooData.stock_quantity = data.stock_quantity;
    if (data.manage_stock !== undefined) wooData.manage_stock = data.manage_stock;
    
    if (data.stock_status !== undefined) {
      // Map standard stock status to WooCommerce format
      switch (data.stock_status) {
        case 'in_stock':
          wooData.stock_status = 'instock';
          break;
        case 'out_of_stock':
          wooData.stock_status = 'outofstock';
          break;
        case 'on_backorder':
          wooData.stock_status = 'onbackorder';
          break;
      }
    }

    return wooData;
  }

  /**
   * Validate that required WooCommerce credentials are present
   */
  private validateWooCommerceCredentials(): void {
    this.validateCredentials(['consumer_key', 'consumer_secret']);
    
    if (!this.credentials?.consumer_key || !this.credentials?.consumer_secret) {
      throw new Error('WooCommerce Consumer Key and Consumer Secret are required');
    }
  }

  /**
   * Get the products count for this store (used for dashboard stats)
   */
  async getProductsCount(): Promise<number> {
    try {
      const response = await this.makeRequest('GET', '/wp-json/wc/v3/products', null, {
        params: { per_page: 1, status: 'publish' }
      });
      
      return parseInt(response.headers['x-wp-total'] || '0');
    } catch (error) {
      console.error(`[WooCommerce] Failed to get products count:`, error);
      return 0;
    }
  }
}