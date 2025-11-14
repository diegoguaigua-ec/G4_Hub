import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SyncLogDetailDrawer } from "./sync-log-detail-drawer";

interface SyncLog {
  id: number;
  storeId: number | null;
  storeName: string;
  storePlatform: string;
  syncType: string;
  status: string;
  syncedCount: number;
  errorCount: number;
  createdAt: string;
  durationMs: number | null;
}

interface SyncLogsResponse {
  logs: SyncLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface SyncLogsSectionProps {
  storeId?: number; // Optional - if provided, filters logs for this store automatically
}

export default function SyncLogsSection({ storeId }: SyncLogsSectionProps = {}) {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    storeId: storeId?.toString() as string | undefined,
    status: undefined as string | undefined,
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
  });

  // Update filters when storeId prop changes
  useEffect(() => {
    if (storeId !== undefined) {
      setFilters(prev => ({
        ...prev,
        storeId: storeId.toString(),
      }));
      // Reset pagination when store changes
      setPagination({
        limit: 20,
        offset: 0,
      });
    }
  }, [storeId]);

  // Build query string
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.storeId) params.append("storeId", filters.storeId);
    if (filters.status) params.append("status", filters.status);
    params.append("limit", pagination.limit.toString());
    params.append("offset", pagination.offset.toString());
    return params.toString();
  };

  // Fetch logs
  const { data, isLoading, refetch } = useQuery<SyncLogsResponse>({
    queryKey: ["/api/sync/logs", filters.storeId, filters.status, pagination.offset, pagination.limit],
    queryFn: async () => {
      const queryString = buildQueryString();
      const res = await fetch(`/api/sync/logs?${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar logs");
      return res.json();
    },
  });

  // Fetch stores for filter
  const { data: stores = [] } = useQuery({
    queryKey: ["/api/stores"],
  });

  const handleViewDetail = (logId: number) => {
    setSelectedLogId(logId);
    setDrawerOpen(true);
  };

  const handleNextPage = () => {
    if (data?.pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit,
      }));
    }
  };

  const handlePrevPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "Completado";
      case "partial":
        return "Con errores";
      case "error":
        return "Fallido";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-700";
      case "partial":
        return "bg-amber-100 text-amber-700";
      case "error":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = data ? Math.ceil(data.pagination.total / pagination.limit) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Historial de Sincronizaciones</h2>
          <p className="text-muted-foreground">Revisa el detalle de todas las sincronizaciones realizadas</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className={`grid grid-cols-1 gap-4 ${storeId ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {/* Store Filter - only show if storeId is not provided */}
            {!storeId && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Tienda
                </label>
                <Select
                  value={filters.storeId}
                  onValueChange={(value) =>
                    setFilters({ ...filters, storeId: value === "all" ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las tiendas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {stores.map((store: any) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.storeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Estado
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? undefined : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="success">Completado</SelectItem>
                  <SelectItem value="partial">Con errores</SelectItem>
                  <SelectItem value="error">Fallido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {data?.pagination.total || 0} sincronizaciones encontradas
            </p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : data?.logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron sincronizaciones</p>
              <p className="text-sm mt-2">Intenta ajustar los filtros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Fecha
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Tienda
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Exitosos
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Fallidos
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Duración
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-foreground">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {log.storeName}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {log.storePlatform}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(log.status)}`}
                          >
                            {getStatusLabel(log.status)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-foreground">
                        {log.syncedCount}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-foreground">
                        {log.errorCount}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(log.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.logs.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!data.pagination.hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <SyncLogDetailDrawer
        logId={selectedLogId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}