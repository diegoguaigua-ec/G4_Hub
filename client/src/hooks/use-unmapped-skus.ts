import { useQuery } from '@tanstack/react-query';

export interface UnmappedSku {
  id: number;
  tenantId: number;
  storeId: number;
  sku: string;
  productName: string | null;
  lastSeenAt: Date;
  occurrences: number;
  resolved: boolean;
  createdAt: Date;
}

interface UnmappedSkusResponse {
  unmapped_skus: UnmappedSku[];
}

/**
 * Hook para obtener SKUs sin mapear de una tienda
 */
export function useUnmappedSkus(storeId: number | null) {
  return useQuery<UnmappedSkusResponse>({
    queryKey: ['unmapped-skus', storeId],
    queryFn: async () => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const response = await fetch(
        `/api/stores/${storeId}/unmapped-skus?resolved=false`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch unmapped SKUs');
      }

      return response.json();
    },
    enabled: !!storeId,
    staleTime: 30000, // 30 segundos
  });
}
