import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, RefreshCw, FileText, Clock, Check, FilePlus, Plus, BarChart, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Store as StoreType } from "@shared/schema";

export default function OverviewSection() {
  // Fetch real stores data
  const { data: stores = [], isLoading, error } = useQuery<StoreType[]>({
    queryKey: ["/api/stores"],
  });

  // Calculate real stats from stores data
  const connectedStores = stores.filter(store => store.connectionStatus === 'connected').length;
  const totalProducts = stores.reduce((total, store) => total + (store.productsCount || 0), 0);
  
  const stats = [
    {
      title: "Tiendas Conectadas",
      value: connectedStores.toString(),
      change: undefined, // Removed until real metrics available
      icon: Store,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Productos Sincronizados",
      value: totalProducts.toLocaleString(),
      change: undefined, // Removed until real metrics available
      icon: RefreshCw,
      color: "bg-primary/10 text-primary"
    },
    // Temporarily hiding unsupported metrics until backend implements them
    // {
    //   title: "Facturas Automatizadas",
    //   value: "Próximamente",
    //   change: "+24%",
    //   icon: FileText,
    //   color: "bg-primary/10 text-primary"
    // },
    // {
    //   title: "Tiempo Prom. Sinc.",
    //   value: "Próximamente",
    //   change: "-",
    //   icon: Clock,
    //   color: "bg-primary/10 text-primary"
    // },
  ];

  // Real activity feed will be implemented when /api/sync-events endpoint is available
  const recentActivity: any[] = []; // Empty until real sync events are available

  const quickActions = [
    { title: "Agregar Tienda", icon: Store },
    { title: "Forzar Sincronización", icon: RefreshCw },
    { title: "Ver Reportes", icon: BarChart },
    { title: "Configuración", icon: Settings },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600">Error al cargar datos del resumen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  {/* Change badges removed until real metrics available */}
                  {stat.change && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {stat.change}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-foreground" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </h3>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Actividad Reciente</h2>
              {/* "Ver todo" button hidden until real sync events are available */}
              {recentActivity.length > 0 && (
                <Button variant="ghost" className="text-primary hover:text-primary/80 text-sm font-medium p-0">
                  Ver todo
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={index} className="flex items-center gap-4" data-testid={`activity-${index}`}>
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{activity.title}</p>
                        <p className="text-muted-foreground text-sm">{activity.store} • {activity.time}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No hay actividad reciente</p>
                  <p className="text-sm text-muted-foreground mt-2">La actividad aparecerá cuando las tiendas realicen sincronizaciones</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Acciones Rápidas</h2>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-3 group hover:bg-muted/50"
                    data-testid={`action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-medium text-foreground text-sm">{action.title}</p>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
