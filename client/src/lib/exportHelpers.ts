import { toast } from 'sonner';

/**
 * Exporta movimientos de inventario a Excel
 * @param storeId - ID de la tienda
 * @param filters - Filtros aplicados (status, type, date_from, date_to)
 * @param storeName - Nombre de la tienda para el nombre del archivo
 */
export async function handleExportMovements(
  storeId: number,
  filters: {
    status?: string;
    type?: string;
    date_from?: string;
    date_to?: string;
  },
  storeName: string
): Promise<void> {
  try {
    // Construir query params
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
      params.append('type', filters.type);
    }
    if (filters.date_from) {
      params.append('date_from', filters.date_from);
    }
    if (filters.date_to) {
      params.append('date_to', filters.date_to);
    }

    const queryString = params.toString();
    const url = `/api/stores/${storeId}/inventory-push/movements/export${queryString ? `?${queryString}` : ''}`;

    // Hacer la petición con fetch para manejar el blob
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Error al exportar movimientos');
    }

    // Obtener el blob
    const blob = await response.blob();

    // Crear URL temporal y descargar
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const today = new Date().toISOString().split('T')[0];
    link.download = `movimientos-push-${storeName}-${today}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar URL temporal
    window.URL.revokeObjectURL(downloadUrl);

    toast.success('Archivo exportado exitosamente');
  } catch (error) {
    console.error('Error exporting movements:', error);
    toast.error('Error al exportar movimientos');
    throw error;
  }
}

/**
 * Exporta SKUs sin mapear a Excel
 * @param storeId - ID de la tienda
 * @param storeName - Nombre de la tienda para el nombre del archivo
 */
export async function handleExportUnmappedSkus(
  storeId: number,
  storeName: string
): Promise<void> {
  try {
    const url = `/api/stores/${storeId}/unmapped-skus/export`;

    // Hacer la petición con fetch para manejar el blob
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Error al exportar SKUs sin mapear');
    }

    // Obtener el blob
    const blob = await response.blob();

    // Crear URL temporal y descargar
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const today = new Date().toISOString().split('T')[0];
    link.download = `skus-sin-mapear-${storeName}-${today}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpiar URL temporal
    window.URL.revokeObjectURL(downloadUrl);

    toast.success('Archivo exportado exitosamente');
  } catch (error) {
    console.error('Error exporting unmapped SKUs:', error);
    toast.error('Error al exportar SKUs sin mapear');
    throw error;
  }
}
