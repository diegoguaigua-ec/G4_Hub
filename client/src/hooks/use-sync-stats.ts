import { useQuery } from '@tanstack/react-query';

interface SyncStats {
  pending: number;
  processing: number;
  completed_24h: number;
  failed_24h: number;
  success_rate: number;
}

/**
 * Hook para obtener estadísticas de sincronización push
 * Se actualiza automáticamente cada 30 segundos
 */
export function useSyncStats(storeId: number | null) {
  return useQuery<SyncStats>({
    queryKey: ['sync-stats', storeId],
    queryFn: async () => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const response = await fetch(`/api/stores/${storeId}/inventory-push/stats`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync stats');
      }

      return response.json();
    },
    enabled: !!storeId,
    refetchInterval: 30000, // Actualizar cada 30 segundos
    staleTime: 25000, // Considerar datos obsoletos después de 25 segundos
  });
}
