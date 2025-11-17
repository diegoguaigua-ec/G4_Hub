import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCw, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tipo" />
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
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Fecha" />
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
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RotateCw className="h-4 w-4 mr-2" />
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
  );
}
