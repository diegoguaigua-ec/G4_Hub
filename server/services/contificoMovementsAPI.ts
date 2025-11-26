import { ContificoConnector } from "../connectors/ContificoConnector";
import { Store } from "@shared/schema";

/**
 * Tipos de movimiento en Contífico
 */
export type MovementType = "ING" | "EGR";

/**
 * Interfaz para el detalle de un movimiento de inventario
 */
interface MovementDetail {
  producto_id: string; // ID del producto en Contífico
  cantidad: string; // Cantidad del movimiento (string según API)
  precio: string; // Precio unitario (string según API)
  serie?: string | null; // Número de serie (opcional)
  edicion?: string | null; // Edición del producto (opcional)
}

/**
 * Interfaz para crear un movimiento de inventario en Contífico
 */
interface CreateMovementRequest {
  tipo: MovementType; // "ING" (ingreso) o "EGR" (egreso)
  bodega_id: string; // ID de la bodega
  fecha: string; // Fecha del movimiento (formato dd/mm/yyyy)
  descripcion?: string; // Descripción del movimiento
  codigo_interno?: string; // Código interno (ej: número de orden)
  generar_asiento?: boolean; // Si se debe generar asiento contable
  bodega_destino_id?: string | null; // ID de bodega destino (para traslados)
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

    // Formatear fecha al formato dd/mm/yyyy requerido por Contífico
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const fecha = `${day}/${month}/${year}`;

    const movement: CreateMovementRequest = {
      tipo: "EGR",
      bodega_id: warehouseId,
      fecha,
      descripcion: notes || `Venta desde tienda e-commerce - SKU: ${sku}`,
      codigo_interno: orderId ? `EGR-${orderId}-${Date.now()}` : `ECOM-${Date.now()}`,
      generar_asiento: false,
      detalles: [
        {
          producto_id: productId,
          cantidad: quantity.toString(),
          precio: "0",
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

    // Formatear fecha al formato dd/mm/yyyy requerido por Contífico
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const fecha = `${day}/${month}/${year}`;

    const movement: CreateMovementRequest = {
      tipo: "ING",
      bodega_id: warehouseId,
      fecha,
      descripcion: notes || `Devolución/Cancelación desde tienda e-commerce - SKU: ${sku}`,
      codigo_interno: orderId ? `ING-${orderId}-${Date.now()}` : `ECOM-RETURN-${Date.now()}`,
      generar_asiento: false,
      detalles: [
        {
          producto_id: productId,
          cantidad: quantity.toString(),
          precio: "0",
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
      const endpoint = "/sistema/api/v1/movimiento-inventario/";

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
