import { useState, useEffect } from "react";
import { SyncMetricsCards } from "./sync-metrics-cards";
import { SyncFilters } from "./sync-filters";
import { MovementsTable } from "./movements-table";
import { MovementDetailModal } from "./movement-detail-modal";
import { UnmappedSkusSection } from "./unmapped-skus-section";
import { useRetryMovement } from "@/hooks/use-retry-movement";
import type { Movement, MovementsFilters } from "@/hooks/use-movements";
import { convertDateRange } from "@/lib/dateFormatters";

interface MovementsTabProps {
  storeId: number | null;
  storeName: string;
}

export function MovementsTab({ storeId, storeName }: MovementsTabProps) {
  const [selectedMovement, setSelectedMovement] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const retryMutation = useRetryMovement(storeId);

  // Cargar filtros desde localStorage o usar valores por defecto
  const getInitialFilters = (): MovementsFilters => {
    if (!storeId) {
      return {
        page: 1,
        limit: 20,
        status: 'all',
        type: 'all',
        dateRange: 'all',
      };
    }

    const savedFilters = localStorage.getItem(`movements-filters-${storeId}`);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        return {
          page: 1, // Siempre empezar en página 1
          limit: parsed.limit || 20,
          status: parsed.status || 'all',
          type: parsed.type || 'all',
          dateRange: parsed.dateRange || 'all',
        };
      } catch {
        // Si hay error al parsear, usar valores por defecto
      }
    }

    return {
      page: 1,
      limit: 20,
      status: 'all',
      type: 'all',
      dateRange: 'all',
    };
  };

  const [filters, setFilters] = useState<MovementsFilters>(getInitialFilters());

  // Resetear filtros cuando cambia la tienda
  useEffect(() => {
    setFilters(getInitialFilters());
  }, [storeId]);

  const handleViewDetails = (movement: Movement) => {
    setSelectedMovement(movement.id);
    setDetailModalOpen(true);
  };

  const handleRetry = async (movementId: number) => {
    await retryMutation.mutateAsync(movementId);
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, page: 1 }); // Reset a página 1 cuando cambian filtros
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <SyncMetricsCards storeId={storeId} />

      {/* Filtros */}
      <SyncFilters
        storeId={storeId}
        storeName={storeName}
        filters={{
          status: filters.status || 'all',
          type: filters.type || 'all',
          dateRange: filters.dateRange || 'all',
          ...convertDateRange(filters.dateRange || 'all', filters.customDateFrom, filters.customDateTo),
        }}
        onFiltersChange={(newFilters) => {
          setFilters({
            ...filters,
            status: newFilters.status,
            type: newFilters.type,
            dateRange: newFilters.dateRange,
            page: 1,
          });
        }}
      />

      {/* Tabla de Movimientos */}
      <MovementsTable
        storeId={storeId}
        filters={filters}
        onFiltersChange={setFilters}
        onViewDetails={handleViewDetails}
        onRetry={handleRetry}
      />

      {/* SKUs sin Mapear */}
      <UnmappedSkusSection storeId={storeId} storeName={storeName} />

      {/* Modal de Detalles */}
      <MovementDetailModal
        storeId={storeId}
        movementId={selectedMovement}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
