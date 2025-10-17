import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Store,
  Clock,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SyncLogDetailDrawerProps {
  logId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SyncLogDetail {
  syncLog: {
    id: number;
    storeName: string;
    storePlatform: string;
    syncType: string;
    status: string;
    syncedCount: number;
    errorCount: number;
    durationMs: number | null;
    createdAt: string;
    details: any;
  };
  items: Array<{
    id: number;
    sku: string;
    productName: string | null;
    status: string;
    stockBefore: number | null;
    stockAfter: number | null;
    errorCategory: string | null;
    errorMessage: string | null;
  }>;
  errorStats: Array<{
    errorCategory: string | null;
    count: number;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
}

export function SyncLogDetailDrawer({
  logId,
  open,
  onOpenChange,
}: SyncLogDetailDrawerProps) {
  const { data, isLoading } = useQuery<SyncLogDetail>({
    queryKey: ["/api/sync/logs", logId],
    enabled: !!logId && open,
    queryFn: async () => {
      const res = await fetch(`/api/sync/logs/${logId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar detalle");
      return res.json();
    },
  });

  const handleDownload = () => {
    if (!logId) return;
    window.location.href = `/api/sync/logs/${logId}/export`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "partial":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getErrorCategoryLabel = (category: string | null) => {
    switch (category) {
      case "not_found_contifico":
        return "No encontrado en Contífico";
      case "not_found_store":
        return "No encontrado en tienda";
      case "no_changes":
        return "Sin cambios";
      case "update_error":
        return "Error de actualización";
      case "api_error":
        return "Error de API";
      case "processing_error":
        return "Error de procesamiento";
      default:
        return category || "Otro";
    }
  };

  if (!logId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle de Sincronización</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-6 mt-6">
            {/* General Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Información General
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tienda</p>
                      <p className="text-sm font-medium text-foreground">
                        {data.syncLog.storeName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {data.syncLog.storePlatform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(data.syncLog.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="text-sm font-medium text-foreground">
                        {data.syncLog.syncType === "pull"
                          ? "Pull (Contífico → Tienda)"
                          : "Push (Tienda → Contífico)"}
                      </p>
                    </div>
                  </div>
                  {data.syncLog.details?.warehouse_name && (
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Bodega</p>
                        <p className="text-sm font-medium text-foreground">
                          {data.syncLog.details.warehouse_name}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {getStatusIcon(data.syncLog.status)}
                    <div>
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <p className="text-sm font-medium text-foreground">
                        {getStatusLabel(data.syncLog.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duración</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDuration(data.syncLog.durationMs)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Exitosos</p>
                      <p className="text-2xl font-bold text-green-600">
                        {data.summary.success}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600/20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Fallidos</p>
                      <p className="text-2xl font-bold text-red-600">
                        {data.summary.failed}
                      </p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-600/20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Omitidos</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {data.summary.skipped}
                      </p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-amber-600/20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Products */}
            {data.summary.failed > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Productos con Errores ({data.summary.failed})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.items
                      .filter((item) => item.status === "failed")
                      .map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border border-red-200 bg-red-50 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {item.sku}
                              </p>
                              {item.productName && (
                                <p className="text-xs text-muted-foreground">
                                  {item.productName}
                                </p>
                              )}
                              <p className="text-xs text-red-600 mt-1">
                                {item.errorMessage || "Error desconocido"}
                              </p>
                            </div>
                            {item.errorCategory && (
                              <Badge variant="outline" className="text-xs">
                                {getErrorCategoryLabel(item.errorCategory)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skipped Products Stats */}
            {data.summary.skipped > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Productos Omitidos ({data.summary.skipped})
                  </h3>
                  <div className="space-y-2">
                    {data.errorStats.map((stat, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                      >
                        <p className="text-sm text-foreground">
                          {getErrorCategoryLabel(stat.errorCategory)}
                        </p>
                        <Badge variant="secondary">{stat.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Export Button */}
            <Button
              onClick={handleDownload}
              className="w-full"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No se pudo cargar el detalle</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}