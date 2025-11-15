import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Store,
  RefreshCw,
  Plug,
  Check,
  BarChart,
  Settings,
  Activity,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store as StoreType } from "@shared/schema";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SyncStats {
  metrics: {
    totalSyncs: number;
    totalProducts: number;
    totalErrors: number;
    successRate: number;
  };
}

interface SyncLog {
  id: number;
  storeId: number;
  syncType: string;
  status: string;
  syncedCount: number;
  errorCount: number;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
  storeName: string;
  storePlatform: string;
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

export default function OverviewSection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch stores data
  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreType[]>(
    {
      queryKey: ["/api/stores"],
    },
  );

  // Fetch store integrations when a store is selected
  const { data: integrationsData } = useQuery({
    queryKey: [`/api/stores/${selectedStoreId}/integrations`],
    queryFn: async () => {
      if (!selectedStoreId) return null;
      const res = await fetch(`/api/stores/${selectedStoreId}/integrations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar integraciones");
      return res.json();
    },
    enabled: !!selectedStoreId,
  });

  // Find Contífico integration
  const contificoIntegration = integrationsData?.find(
    (integration: any) =>
      integration.integration?.name?.toLowerCase().includes("contífico") ||
      integration.integration?.name?.toLowerCase().includes("contifico")
  );

  // Fetch sync stats
  const { data: syncStats, isLoading: statsLoading } = useQuery<SyncStats>({
    queryKey: ["/api/sync/stats"],
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery<SyncLogsResponse>({
    queryKey: ["/api/sync/logs", { limit: 10 }],
    queryFn: async () => {
      const res = await fetch("/api/sync/logs?limit=10", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar actividad reciente");
      return res.json();
    },
  });

  const isLoading = storesLoading || statsLoading;

  // Calculate stats
  const connectedStores = stores.filter(
    (store) => store.connectionStatus === "connected",
  ).length;
  const totalProducts = stores.reduce(
    (total, store) => total + (store.productsCount || 0),
    0,
  );

  const stats = [
    {
      title: "Tiendas Conectadas",
      value: connectedStores.toString(),
      icon: Store,
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      title: "Productos Sincronizados",
      value: totalProducts.toLocaleString(),
      icon: Package,
      color: "bg-green-500/10 text-green-600",
    },
    {
      title: "Sincronizaciones",
      value: syncStats?.metrics.totalSyncs || 0,
      subtitle: "Últimos 7 días",
      icon: Activity,
      color: "bg-purple-500/10 text-purple-600",
    },
    {
      title: "Tasa de Éxito",
      value: `${syncStats?.metrics.successRate || 0}%`,
      subtitle: "Promedio",
      icon: TrendingUp,
      color: "bg-orange-500/10 text-orange-600",
    },
  ];

  // Quick actions handlers
  const handleAddStore = () => {
    setLocation("/dashboard/stores");
  };

  const handleForceSyncClick = () => {
    setSyncDialogOpen(true);
  };

  const handleForceSync = async () => {
    if (!selectedStoreId) {
      toast({
        title: "Selecciona una tienda",
        description: "Debes seleccionar una tienda para sincronizar",
        variant: "destructive",
      });
      return;
    }

    if (!contificoIntegration) {
      toast({
        title: "Sin integración",
        description: "No se encontró integración de Contífico para esta tienda",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(
        `/api/sync/pull/${selectedStoreId}/${contificoIntegration.integrationId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dryRun: false,
            limit: 1000,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al sincronizar");
      }

      const data = await res.json();

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });

      toast({
        title: "Sincronización completada",
        description: `${data.result.success} productos actualizados, ${data.result.skipped} omitidos, ${data.result.failed} fallidos`,
      });

      setSyncDialogOpen(false);
      setSelectedStoreId("");
    } catch (error: any) {
      toast({
        title: "Error al sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIntegrations = () => {
    setLocation("/dashboard/integrations");
  };

  const handleSettings = () => {
    setLocation("/dashboard/settings");
  };

  const quickActions = [
    { title: "Agregar Tienda", icon: Store, onClick: handleAddStore },
    { title: "Sincronización manual", icon: RefreshCw, onClick: handleForceSyncClick },
    { title: "Integraciones", icon: Plug, onClick: handleIntegrations },
    { title: "Configuración", icon: Settings, onClick: handleSettings },
  ];

  // Helper to format last sync time
  const formatLastSync = (lastSyncAt?: Date | string | null) => {
    if (!lastSyncAt) return "Nunca";
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Hace menos de 1 hora";
    if (diffInHours < 24)
      return `Hace ${diffInHours} hora${diffInHours > 1 ? "s" : ""}`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? "s" : ""}`;
  };

  // Helper to format activity timestamp
  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Hace un momento";
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    // If more than 7 days, show date
    return date.toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper to get sync type label
  const getSyncTypeLabel = (syncType: string) => {
    if (syncType === 'pull') return 'Desde Contífico';
    if (syncType === 'push') return 'A Contífico';
    return syncType;
  };

  // Helper to get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-500/10',
          label: 'Completado'
        };
      case 'partial':
      case 'completed_with_errors':
        return {
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500/10',
          label: 'Parcial'
        };
      case 'failed':
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-500/10',
          label: 'Fallido'
        };
      case 'pending':
      case 'running':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-500/10',
          label: 'En progreso'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-500/10',
          label: status
        };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Resumen</h2>
          <p className="text-muted-foreground">
            Monitorea el rendimiento de tu automatización de e-commerce
          </p>
        </div>
        <NotificationsDropdown />
      </div>

      {/* Stats Grid - 4 columnas en una fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">
                      {stat.title}
                    </p>
                    <h3 className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </h3>
                    {stat.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.subtitle}
                      </p>
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions - Más espaciados */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                onClick={action.onClick}
                className="h-auto py-6 flex flex-col items-center justify-center gap-3 hover:bg-primary/5"
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{action.title}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Actividad Reciente
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard/integrations")}
            >
              Ver Todo
            </Button>
          </div>

          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentActivity && recentActivity.logs.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.logs.map((log) => {
                const statusInfo = getStatusInfo(log.status);
                const StatusIcon = statusInfo.icon;
                const SyncIcon = log.syncType === 'pull' ? ArrowDownCircle : ArrowUpCircle;

                return (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg ${statusInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {log.storeName}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {log.storePlatform}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <SyncIcon className="h-3 w-3" />
                          <span>{getSyncTypeLabel(log.syncType)}</span>
                          <span>•</span>
                          <span>{formatActivityTime(log.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-600">
                            {log.syncedCount} sincronizados
                          </span>
                          {log.errorCount > 0 && (
                            <span className="text-red-600">
                              {log.errorCount} errores
                            </span>
                          )}
                          {log.durationMs && (
                            <span className="text-muted-foreground">
                              {(log.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-600 mt-1 truncate">
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        log.status === 'completed' || log.status === 'success'
                          ? 'default'
                          : log.status === 'partial' || log.status === 'completed_with_errors'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="ml-2 flex-shrink-0"
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay actividad reciente</p>
              <p className="text-sm mt-2">
                La actividad aparecerá cuando las tiendas realicen
                sincronizaciones
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Stores Status */}
      {stores.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Estado de Tiendas
            </h3>
            <div className="space-y-3">
              {stores.map((store) => {
                const hasRecentSync =
                  store.lastSyncAt &&
                  new Date().getTime() - new Date(store.lastSyncAt).getTime() <
                    24 * 60 * 60 * 1000;

                return (
                  <div
                    key={store.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {store.storeName}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {store.platform}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Última sincronización
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {formatLastSync(store.lastSyncAt)}
                        </p>
                      </div>
                      {hasRecentSync && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Force Sync Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronización manual</DialogTitle>
            <DialogDescription>
              Selecciona una tienda para iniciar una sincronización manual de inventario
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tienda" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      <span>{store.storeName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({store.platform})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialogOpen(false)}
              disabled={isSyncing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleForceSync}
              disabled={isSyncing || !selectedStoreId}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
