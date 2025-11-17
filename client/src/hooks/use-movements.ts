import { useQuery } from '@tanstack/react-query';
import { convertDateRange } from '@/lib/dateFormatters';

export interface Movement {
  id: number;
  tenantId: number;
  storeId: number;
  integrationId: number;
  movementType: 'egreso' | 'ingreso';
  sku: string;
  quantity: number;
  orderId: string | null;
  eventType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  errorMessage: string | null;
  metadata: any;
  createdAt: Date;
  processedAt: Date | null;
}

export interface MovementsFilters {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  dateRange?: string;
  customDateFrom?: Date;
  customDateTo?: Date;
}

interface MovementsResponse {
  movements: Movement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Hook para obtener movimientos de inventario con filtros
 */
export function useMovements(storeId: number | null, filters: MovementsFilters) {
  return useQuery<MovementsResponse>({
    queryKey: ['movements', storeId, filters],
    queryFn: async () => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      // Construir query params
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
      });

      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }

      if (filters.type && filters.type !== 'all') {
        params.append('type', filters.type);
      }

      // Convertir date range a fechas específicas
      if (filters.dateRange && filters.dateRange !== 'all') {
        const dateRangeResult = convertDateRange(
          filters.dateRange,
          filters.customDateFrom,
          filters.customDateTo
        );

        if (dateRangeResult.date_from) {
          params.append('date_from', dateRangeResult.date_from);
        }

        if (dateRangeResult.date_to) {
          params.append('date_to', dateRangeResult.date_to);
        }
      }

      const response = await fetch(
        `/api/stores/${storeId}/inventory-push/movements?${params.toString()}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch movements');
      }

      return response.json();
    },
    enabled: !!storeId,
    placeholderData: (previousData) => previousData, // keepPreviousData equivalente en v5
    staleTime: 10000, // 10 segundos
  });
}
