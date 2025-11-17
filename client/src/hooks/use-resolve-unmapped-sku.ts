import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook para marcar un SKU como resuelto
 */
export function useResolveUnmappedSku(storeId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skuId: number) => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const response = await fetch(
        `/api/stores/${storeId}/unmapped-skus/${skuId}/resolve`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resolve SKU');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar query de SKUs sin mapear
      queryClient.invalidateQueries({ queryKey: ['unmapped-skus', storeId] });

      toast.success('SKU marcado como resuelto');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al resolver SKU');
    },
  });
}
