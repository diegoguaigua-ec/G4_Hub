import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Store,
  RefreshCw,
  FileText,
  Check,
  BarChart,
  Settings,
  Bell,
  Activity,
  Package,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Store as StoreType } from "@shared/schema";

interface SyncStats {
  metrics: {
    totalSyncs: number;
    totalProducts: number;
    totalErrors: number;
    successRate: number;
  };
}

export default function OverviewSection() {
  // Fetch stores data
  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreType[]>(
    {
      queryKey: ["/api/stores"],
    },
  );

  // Fetch sync stats
  const { data: syncStats, isLoading: statsLoading } = useQuery<SyncStats>({
    queryKey: ["/api/sync/stats"],
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

  const quickActions = [
    { title: "Agregar Tienda", icon: Store },
    { title: "Forzar Sincronización", icon: RefreshCw },
    { title: "Ver Reportes", icon: FileText },
    { title: "Configuración", icon: Settings },
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </Button>
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
                className="h-auto py-6 flex flex-col items-center justify-center gap-3"
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
            <Button variant="ghost" size="sm">
              Ver Todo
            </Button>
          </div>

          <div className="text-center py-8 text-muted-foreground">
            <p>No hay actividad reciente</p>
            <p className="text-sm mt-2">
              La actividad aparecerá cuando las tiendas realicen
              sincronizaciones
            </p>
          </div>
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
    </div>
  );
}
