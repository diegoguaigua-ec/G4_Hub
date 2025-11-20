import {
  BaseConnector,
  ConnectionResult,
  ProductsResult,
  ProductResult,
  UpdateResult,
  StoreInfoResult,
  StandardProduct,
} from "./BaseConnector";
import { AxiosRequestConfig } from "axios";
import { Store } from "@shared/schema";

interface ContificoCredentials {
  env: "test" | "prod";
  api_keys: {
    test: string;
    prod: string;
  };
  warehouse_primary?: string;
  warehouse_tokens?: Record<string, string>;
}

interface ContificoProduct {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio_venta: number;
  precio_compra?: number;
  cantidad_stock: number;
  activo: boolean;
  categoria?: string;
  marca?: string;
  iva?: number;
  ice?: number;
  [key: string]: any;
}

interface ContificoWarehouse {
  id: string;
  codigo?: string;
  nombre: string;
  direccion?: string;
  activo: boolean;
  [key: string]: any;
}

interface ContificoStockByWarehouse {
  bodega_id: string;
  cantidad: number;
  producto_id: string;
  [key: string]: any;
}

export class ContificoConnector extends BaseConnector {
  private contificoCredentials: ContificoCredentials;
  private currentEnv: "test" | "prod";

  constructor(store: Store) {
    super(store);
    this.validateContificoCredentials();
    this.contificoCredentials = store.apiCredentials as ContificoCredentials;
    this.currentEnv = this.contificoCredentials.env || "prod";
  }

  protected authenticateRequest(
    config: AxiosRequestConfig,
  ): AxiosRequestConfig {
    const apiKey = this.getCurrentApiKey();

    const headers: any = { ...config.headers };
    headers["Authorization"] = apiKey;
    headers["Content-Type"] = "application/json";

    return {
      ...config,
      headers,
    };
  }

  private getCurrentApiKey(): string {
    return this.contificoCredentials.api_keys[this.currentEnv];
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      console.log(`[Contífico] Probando conexión (${this.currentEnv}) a ${this.baseUrl}`);

      // Solo probar el endpoint de bodegas (más rápido)
      const response = await this.makeRequest('GET', '/sistema/api/v1/bodega/');

      if (!Array.isArray(response.data)) {
        throw new Error('Formato de respuesta inválido de la API de Contífico');
      }

      const warehouses: ContificoWarehouse[] = response.data;

      return {
        success: true,
        store_name: `Contífico (${this.currentEnv})`,
        details: {
          environment: this.currentEnv,
          warehouses_count: warehouses.length,
          warehouses: warehouses.map(w => ({ id: w.id, name: w.nombre })),
          primary_warehouse: this.contificoCredentials.warehouse_primary || null,
          api_version: 'v1',
          message: 'Conexión exitosa. Las bodegas están disponibles.'
        }
      };
    } catch (error: any) {
      console.error(`[Contífico] Prueba de conexión falló:`, error.message);

      let errorMessage = 'No se pudo conectar con Contífico';

      if (error.status === 401 || error.status === 403) {
        errorMessage = 'API Key inválida. Verifica tus credenciales de Contífico.';
      } else if (error.status === 404) {
        errorMessage = 'Endpoint de API de Contífico no encontrado. Verifica la URL base.';
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('timeout')) {
        errorMessage = 'No se pudo conectar con Contífico. Tiempo de espera agotado o problema de conectividad.';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          environment: this.currentEnv,
          original_error: error.message,
          status: error.status,
          code: error.code
        }
      };
    }
  }

  async getWarehouses(): Promise<ContificoWarehouse[]> {
    try {
      const response = await this.makeRequest("GET", "/sistema/api/v1/bodega/");
      return response.data as ContificoWarehouse[];
    } catch (error) {
      console.error("[Contífico] Error al obtener bodegas:", error);
      throw error;
    }
  }

  async getProducts(
    page: number = 1,
    limit: number = 100,
  ): Promise<ProductsResult> {
    try {
      console.log(
        `[Contífico] Obteniendo productos (página ${page}, límite ${limit})`,
      );

      const response = await this.makeRequest(
        "GET",
        "/sistema/api/v1/producto/",
      );

      if (!Array.isArray(response.data)) {
        throw new Error("Respuesta de productos inválida de Contífico");
      }

      const allProducts: ContificoProduct[] = response.data.filter(
        (p) => p.activo,
      );

      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedProducts = allProducts.slice(start, end);

      const standardProducts = paginatedProducts.map((p) =>
        this.transformFromContifico(p),
      );

      const totalPages = Math.ceil(allProducts.length / limit);

      return {
        products: standardProducts,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: allProducts.length,
          has_next: end < allProducts.length,
        },
      };
    } catch (error: any) {
      console.error("[Contífico] Error al obtener productos:", error);
      throw new Error(
        `Error al obtener productos de Contífico: ${error.message}`,
      );
    }
  }

  async getProduct(productId: string): Promise<ProductResult> {
    try {
      console.log(`[Contífico] Obteniendo producto con SKU/ID: ${productId}`);

      const response = await this.makeRequest(
        "GET",
        "/sistema/api/v1/producto/",
        null,
        {
          params: { codigo: productId },
        },
      );

      // 🔍 DEBUG: Logging detallado de la respuesta
      console.log(`[Contífico][DEBUG] Tipo de response.data:`, typeof response.data);
      console.log(`[Contífico][DEBUG] Es array:`, Array.isArray(response.data));
      if (Array.isArray(response.data)) {
        console.log(`[Contífico][DEBUG] Tamaño del array:`, response.data.length);
        if (response.data.length > 0) {
          console.log(`[Contífico][DEBUG] Primer producto:`, JSON.stringify(response.data[0], null, 2));
        }
      } else {
        console.log(`[Contífico][DEBUG] response.data:`, JSON.stringify(response.data, null, 2));
      }

      if (!Array.isArray(response.data) || response.data.length === 0) {
        throw new Error(`Producto con SKU ${productId} no encontrado`);
      }

      const exactMatch = response.data.find(
        (p: ContificoProduct) => p.codigo === productId,
      );
      const product = exactMatch || response.data[0];

      return {
        product: this.transformFromContifico(product),
      };
    } catch (error: any) {
      console.error(`[Contífico] Error al obtener producto ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Busca un producto específicamente por SKU
   * Wrapper de getProduct() para mayor claridad en el código
   */
  async getProductBySku(sku: string): Promise<ProductResult> {
    return this.getProduct(sku);
  }

  async getProductStock(productId: string, sku: string): Promise<number> {
    const primaryWarehouse = this.contificoCredentials.warehouse_primary;

    if (!primaryWarehouse) {
      const productResult = await this.getProduct(sku);
      return productResult.product?.stock_quantity ?? 0;
    }

    try {
      const response = await this.makeRequest(
        "GET",
        `/sistema/api/v1/producto/${productId}/stock/`,
      );

      if (!Array.isArray(response.data)) {
        console.warn("[Contífico] Formato de respuesta de stock inválido");
        return 0;
      }

      const warehouseStock: ContificoStockByWarehouse[] = response.data;
      const primaryStock = warehouseStock.find(
        (s) => s.bodega_id === primaryWarehouse,
      );

      return primaryStock?.cantidad ?? 0;
    } catch (error) {
      console.error(
        `[Contífico] Error al obtener stock del producto ${productId}:`,
        error,
      );
      return 0;
    }
  }

  async updateProduct(
    _productId: string,
    _data: Partial<StandardProduct>,
  ): Promise<UpdateResult> {
    throw new Error("Actualización de productos aún no implementada para Contífico");
  }

  async getStoreInfo(): Promise<StoreInfoResult> {
    try {
      const warehouses = await this.getWarehouses();
      const productsCount = await this.getProductsCount();

      return {
        name: `Contífico (${this.currentEnv})`,
        domain: this.baseUrl,
        currency: "USD",
        timezone: "America/Guayaquil",
        products_count: productsCount,
      };
    } catch (error: any) {
      throw new Error(`Error al obtener información de la tienda: ${error.message}`);
    }
  }

  private transformFromContifico(
    contificoProduct: ContificoProduct,
  ): StandardProduct {
    return {
      id: contificoProduct.id,
      sku: contificoProduct.codigo,
      name: contificoProduct.nombre,
      price: Math.round(contificoProduct.precio_venta * 100),
      stock_quantity: contificoProduct.cantidad_stock,
      manage_stock: true,
      stock_status:
        contificoProduct.cantidad_stock > 0 ? "in_stock" : "out_of_stock",
      images: [],
      platform: "contifico",
      raw_data: contificoProduct,
    };
  }

  private validateContificoCredentials(): void {
    const creds = this.credentials as ContificoCredentials;

    if (!creds) {
      throw new Error("Las credenciales de Contífico son requeridas");
    }

    if (!creds.env || !["test", "prod"].includes(creds.env)) {
      throw new Error('El entorno de Contífico debe ser "test" o "prod"');
    }

    if (!creds.api_keys || !creds.api_keys[creds.env]) {
      throw new Error(`La API Key para el entorno ${creds.env} es requerida`);
    }
  }

  async getProductsCount(): Promise<number> {
    try {
      const response = await this.makeRequest(
        "GET",
        "/sistema/api/v1/producto/",
      );
      if (Array.isArray(response.data)) {
        return response.data.filter((p: ContificoProduct) => p.activo).length;
      }
      return 0;
    } catch (error) {
      console.error("[Contífico] Error al obtener conteo de productos:", error);
      return 0;
    }
  }

  async getProductsWithSku(): Promise<any[]> {
    throw new Error('Método no soportado para Contífico');
  }

  async updateVariantStock(): Promise<boolean> {
    throw new Error('Método no soportado para Contífico');
  }

  async updateProductStock(): Promise<boolean> {
    throw new Error('Método no soportado para Contífico');
  }
}