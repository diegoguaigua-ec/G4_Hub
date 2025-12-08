import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Loader2, Download, X } from "lucide-react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { handleExportMovements } from "@/lib/exportHelpers";

interface SyncFiltersProps {
  storeId: number | null;
  storeName: string;
  filters: {
    status: string;
    type: string;
    dateRange: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function SyncFilters({ storeId, storeName, filters, onFiltersChange }: SyncFiltersProps) {
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  // Detectar si las queries de movimientos están actualizándose
  const isFetchingMovements = useIsFetching({ queryKey: ['movements', storeId] });
  const isFetchingStats = useIsFetching({ queryKey: ['sync-stats', storeId] });
  const isRefreshing = isFetchingMovements > 0 || isFetchingStats > 0;

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    if (storeId) {
      localStorage.setItem(
        `movements-filters-${storeId}`,
        JSON.stringify(filters)
      );
    }
  }, [storeId, filters]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['movements', storeId] });
    queryClient.invalidateQueries({ queryKey: ['sync-stats', storeId] });
    // También invalidar detalles de movimientos para que se actualicen los modales abiertos
    queryClient.invalidateQueries({ queryKey: ['movement-detail', storeId] });
  };

  const handleExport = async () => {
    if (!storeId) return;

    setIsExporting(true);
    try {
      await handleExportMovements(storeId, filters, storeName);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper functions to get filter labels
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'all': return 'Todos';
      case 'pending': return 'Pendientes';
      case 'processing': return 'En proceso';
      case 'completed': return 'Completados';
      case 'failed': return 'Fallidos';
      default: return 'Todos';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'all': return 'Todos';
      case 'egreso': return 'Egresos (Ventas)';
      case 'ingreso': return 'Ingresos (Devoluciones)';
      default: return 'Todos';
    }
  };

  const getDateLabel = (dateRange: string) => {
    switch (dateRange) {
      case 'all': return 'Todo';
      case 'today': return 'Hoy';
      case 'last_7_days': return 'Últimos 7 días';
      case 'last_30_days': return 'Últimos 30 días';
      default: return 'Todo';
    }
  };

  // Check if there are active filters
  const hasActiveFilters = filters.status !== 'all' || filters.type !== 'all' || filters.dateRange !== 'all';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue>
              Estado: {getStatusLabel(filters.status)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="processing">En proceso</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="failed">Fallidos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(value) => onFiltersChange({ ...filters, type: value })}
        >
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue>
              Tipo: {getTypeLabel(filters.type)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="egreso">Egresos (Ventas)</SelectItem>
            <SelectItem value="ingreso">Ingresos (Devoluciones)</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.dateRange}
          onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue>
              Fecha: {getDateLabel(filters.dateRange)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo</SelectItem>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="last_7_days">Últimos 7 días</SelectItem>
            <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Actualizar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exportando..." : "Exportar"}
        </Button>
      </div>
      </div>

      {/* Active Filters Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtros activos:</span>
          {filters.status !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onFiltersChange({ ...filters, status: 'all' })}
            >
              Estado: {getStatusLabel(filters.status)}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.type !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onFiltersChange({ ...filters, type: 'all' })}
            >
              Tipo: {getTypeLabel(filters.type)}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.dateRange !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onFiltersChange({ ...filters, dateRange: 'all' })}
            >
              Fecha: {getDateLabel(filters.dateRange)}
              <X className="h-3 w-3" />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onFiltersChange({ status: 'all', type: 'all', dateRange: 'all' })}
          >
            Limpiar todos
          </Button>
        </div>
      )}
    </div>
  );
}
