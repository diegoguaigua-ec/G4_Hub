import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook para reintentar un movimiento fallido
 */
export function useRetryMovement(storeId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movementId: number) => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const response = await fetch(
        `/api/stores/${storeId}/inventory-push/movements/${movementId}/retry`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to retry movement');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['movements', storeId] });
      queryClient.invalidateQueries({ queryKey: ['sync-stats', storeId] });

      toast.success('Movimiento enviado a la cola de reintentos');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al reintentar movimiento');
    },
  });
}
