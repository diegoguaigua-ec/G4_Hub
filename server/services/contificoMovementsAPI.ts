import { ContificoConnector } from "../connectors/ContificoConnector";
import { Store } from "@shared/schema";

/**
 * Tipos de movimiento en Contífico
 */
export type MovementType = "egreso" | "ingreso";

/**
 * Interfaz para el detalle de un movimiento de inventario
 */
interface MovementDetail {
  producto_id: string; // ID del producto en Contífico
  cantidad: number; // Cantidad del movimiento (siempre positivo)
  costo?: number; // Costo unitario (opcional)
  descripcion?: string; // Descripción adicional del ítem
}

/**
 * Interfaz para crear un movimiento de inventario en Contífico
 */
interface CreateMovementRequest {
  tipo: MovementType; // "egreso" o "ingreso"
  bodega_id: string; // ID de la bodega
  fecha: string; // Fecha del movimiento (ISO 8601)
  referencia?: string; // Número de referencia (ej: número de orden)
  observaciones?: string; // Observaciones adicionales
  detalles: MovementDetail[]; // Detalles de productos
}

/**
 * Respuesta de Contífico al crear un movimiento
 */
interface MovementResponse {
  id: string;
  tipo: string;
  bodega_id: string;
  fecha: string;
  estado: string;
  referencia?: string;
  observaciones?: string;
  detalles: any[];
  [key: string]: any;
}

/**
 * Servicio para gestionar movimientos de inventario en Contífico
 * Maneja egresos (salidas) e ingresos (entradas) de productos
 */
export class ContificoMovementsAPI {
  private connector: ContificoConnector;

  constructor(store: Store) {
    this.connector = new ContificoConnector(store);
  }

  /**
   * Busca un producto en Contífico por SKU
   * @param sku - SKU del producto
   * @returns ID del producto en Contífico o null si no se encuentra
   */
  async findProductIdBySku(sku: string): Promise<string | null> {
    try {
      console.log(`[ContificoMovements] Buscando producto por SKU: ${sku}`);

      // Buscar producto por código/SKU
      const result = await this.connector.getProductBySku(sku);

      if (result.product) {
        console.log(`[ContificoMovements] Producto encontrado: ${result.product.id}`);
        return result.product.id as string;
      }

      console.log(`[ContificoMovements] Producto no encontrado para SKU: ${sku}`);
      return null;
    } catch (error: any) {
      console.error(`[ContificoMovements] Error buscando producto:`, error.message);
      throw new Error(`Error al buscar producto con SKU ${sku}: ${error.message}`);
    }
  }

  /**
   * Registra un egreso de inventario (venta, salida)
   * @param warehouseId - ID de la bodega en Contífico
   * @param sku - SKU del producto
   * @param quantity - Cantidad a egresar
   * @param orderId - ID de la orden de referencia
   * @param notes - Notas adicionales
   * @returns Respuesta de Contífico
   */
  async sendEgreso(
    warehouseId: string,
    sku: string,
    quantity: number,
    orderId?: string,
    notes?: string,
  ): Promise<MovementResponse> {
    // Buscar el producto por SKU
    const productId = await this.findProductIdBySku(sku);

    if (!productId) {
      throw new Error(`Producto con SKU ${sku} no encontrado en Contífico`);
    }

    const movement: CreateMovementRequest = {
      tipo: "egreso",
      bodega_id: warehouseId,
      fecha: new Date().toISOString(),
      referencia: orderId || `ECOM-${Date.now()}`,
      observaciones: notes || `Venta desde tienda e-commerce - SKU: ${sku}`,
      detalles: [
        {
          producto_id: productId,
          cantidad: quantity,
          descripcion: `Egreso automático - SKU: ${sku}`,
        },
      ],
    };

    return await this.createMovement(movement);
  }

  /**
   * Registra un ingreso de inventario (cancelación, devolución)
   * @param warehouseId - ID de la bodega en Contífico
   * @param sku - SKU del producto
   * @param quantity - Cantidad a ingresar
   * @param orderId - ID de la orden de referencia
   * @param notes - Notas adicionales
   * @returns Respuesta de Contífico
   */
  async sendIngreso(
    warehouseId: string,
    sku: string,
    quantity: number,
    orderId?: string,
    notes?: string,
  ): Promise<MovementResponse> {
    // Buscar el producto por SKU
    const productId = await this.findProductIdBySku(sku);

    if (!productId) {
      throw new Error(`Producto con SKU ${sku} no encontrado en Contífico`);
    }

    const movement: CreateMovementRequest = {
      tipo: "ingreso",
      bodega_id: warehouseId,
      fecha: new Date().toISOString(),
      referencia: orderId || `ECOM-RETURN-${Date.now()}`,
      observaciones: notes || `Devolución/Cancelación desde tienda e-commerce - SKU: ${sku}`,
      detalles: [
        {
          producto_id: productId,
          cantidad: quantity,
          descripcion: `Ingreso automático - SKU: ${sku}`,
        },
      ],
    };

    return await this.createMovement(movement);
  }

  /**
   * Crea un movimiento de inventario en Contífico
   * @param movement - Datos del movimiento
   * @returns Respuesta de Contífico
   */
  private async createMovement(
    movement: CreateMovementRequest,
  ): Promise<MovementResponse> {
    try {
      console.log(
        `[ContificoMovements] Creando ${movement.tipo} en bodega ${movement.bodega_id}`,
      );
      console.log(
        `[ContificoMovements] Detalles:`,
        JSON.stringify(movement.detalles, null, 2),
      );

      // Endpoint de movimientos de inventario en Contífico
      const endpoint = "/sistema/api/v1/movimiento/";

      const response = await this.connector["makeRequest"](
        "POST",
        endpoint,
        movement,
      );

      console.log(
        `[ContificoMovements] ✅ Movimiento creado exitosamente: ${response.data?.id}`,
      );

      return response.data as MovementResponse;
    } catch (error: any) {
      console.error(
        `[ContificoMovements] ❌ Error creando movimiento:`,
        error.message,
      );

      // Extraer mensaje de error más específico
      let errorMessage = error.message;
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      throw new Error(`Error al crear ${movement.tipo} en Contífico: ${errorMessage}`);
    }
  }

  /**
   * Verifica la disponibilidad de stock antes de un egreso
   * @param warehouseId - ID de la bodega
   * @param sku - SKU del producto
   * @param quantity - Cantidad requerida
   * @returns true si hay stock suficiente, false en caso contrario
   */
  async checkStockAvailability(
    warehouseId: string,
    sku: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      const productId = await this.findProductIdBySku(sku);

      if (!productId) {
        console.log(`[ContificoMovements] Producto no encontrado para verificar stock: ${sku}`);
        return false;
      }

      // Obtener el stock del producto en la bodega específica
      const stock = await this.connector.getProductStock(productId, sku, warehouseId);
      const availableStock = Math.floor(Number(stock) || 0);

      console.log(
        `[ContificoMovements] Stock disponible para SKU ${sku}: ${availableStock} (requerido: ${quantity})`,
      );

      return availableStock >= quantity;
    } catch (error: any) {
      console.error(
        `[ContificoMovements] Error verificando stock:`,
        error.message,
      );
      // En caso de error, devolver false por seguridad
      return false;
    }
  }
}
