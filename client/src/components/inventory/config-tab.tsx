import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Clock, Database, TrendingUp, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConfigTabProps {
  storeId: number;
}

interface StoreIntegration {
  id: number;
  integrationId: number;
  integration?: {
    id: number;
    name: string;
    integrationType: string;
  };
  syncConfig: {
    pull?: {
      enabled?: boolean;
      interval?: 'hourly' | 'daily' | 'weekly';
      warehouse?: string;
    };
  };
  isActive: boolean;
}

interface SyncStats {
  lastSyncAt: string | null;
  totalProducts: number;
  successRate: number;
}

const SYNC_INTERVALS = [
  { value: "hourly", label: "Cada hora" },
  { value: "daily", label: "Cada día" },
  { value: "weekly", label: "Cada semana" },
];

export function ConfigTab({ storeId }: ConfigTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoSync, setAutoSync] = useState(false);
  const [interval, setInterval] = useState<'hourly' | 'daily' | 'weekly'>("daily");
  const [warehouse, setWarehouse] = useState("");

  // Fetch store integrations (Contífico)
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<StoreIntegration[]>({
    queryKey: [`/api/stores/${storeId}/integrations`],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/integrations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar integraciones");
      return res.json();
    },
  });

  // Find Contífico integration
  const contificoIntegration = integrations.find((i) =>
    i.integration?.name?.toLowerCase().includes("contífico") ||
    i.integration?.name?.toLowerCase().includes("contifico")
  );

  // Update form state when integrations load
  useEffect(() => {
    if (contificoIntegration?.syncConfig?.pull) {
      setAutoSync(contificoIntegration.syncConfig.pull.enabled || false);
      setInterval(contificoIntegration.syncConfig.pull.interval || "daily");
      setWarehouse(contificoIntegration.syncConfig.pull.warehouse || "");
    }
  }, [contificoIntegration]);

  // Fetch warehouses from Contífico
  const { data: warehousesData, isLoading: warehousesLoading, error: warehousesError } = useQuery({
    queryKey: [`/api/integrations/${contificoIntegration?.integrationId}/warehouses`],
    queryFn: async () => {
      const res = await fetch(
        `/api/integrations/${contificoIntegration?.integrationId}/warehouses`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(error.message || "Error al cargar bodegas");
      }
      return res.json();
    },
    enabled: !!contificoIntegration?.integrationId,
  });

  const warehouses = warehousesData?.warehouses || [];

  // Fetch sync stats
  const { data: stats } = useQuery<SyncStats>({
    queryKey: [`/api/stores/${storeId}/sync-stats`],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/sync-stats`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json();
    },
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: { pull: { enabled: boolean; interval: string; warehouse: string } }) => {
      if (!contificoIntegration) {
        throw new Error("No se encontró la integración de Contífico");
      }

      const res = await fetch(
        `/api/stores/${storeId}/integrations/${contificoIntegration.integrationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            syncConfig: config,
          }),
        }
      );

      if (!res.ok) throw new Error("Error al guardar configuración");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/integrations`] });
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateConfigMutation.mutate({
      pull: {
        enabled: autoSync,
        interval,
        warehouse,
      },
    });
  };

  const calculateNextSync = () => {
    if (!autoSync || !stats?.lastSyncAt) return "N/A";
    const lastSync = new Date(stats.lastSyncAt);

    // Calculate interval in hours
    let intervalHours = 1; // default hourly
    if (interval === 'daily') intervalHours = 24;
    if (interval === 'weekly') intervalHours = 168;

    const nextSync = new Date(lastSync.getTime() + intervalHours * 60 * 60 * 1000);

    const now = new Date();
    const diff = nextSync.getTime() - now.getTime();
    const hoursLeft = Math.floor(diff / (60 * 60 * 1000));
    const minutesLeft = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    if (diff < 0) return "Ahora";
    if (hoursLeft < 1) return `En ${minutesLeft} min`;
    if (hoursLeft < 24) return `En ${hoursLeft}h ${minutesLeft}min`;
    const daysLeft = Math.floor(hoursLeft / 24);
    return `En ${daysLeft} día${daysLeft > 1 ? 's' : ''}`;
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (60 * 1000));

    if (minutes < 1) return "Hace un momento";
    if (minutes < 60) return `Hace ${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} días`;
  };

  if (integrationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show message if no Contífico integration exists
  if (!contificoIntegration) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Configuración de Sincronización
          </h2>
          <p className="text-muted-foreground">
            Gestiona cómo se sincronizan los productos entre tu tienda y Contífico
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No se encontró una integración de Contífico configurada para esta tienda.
            Por favor, ve a la sección de <strong>Integraciones</strong> para crear una integración de Contífico
            con tu API Key y selecciona el ambiente (producción o prueba).
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Configuración de Sincronización
        </h2>
        <p className="text-muted-foreground">
          Gestiona cómo se sincronizan los productos entre tu tienda y Contífico
        </p>
      </div>

      {/* Auto Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Sincronización Automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Activar sincronización automática</p>
              <p className="text-sm text-muted-foreground">
                Los productos se sincronizarán automáticamente según el intervalo configurado
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>

          {autoSync && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Intervalo de sincronización
                </label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_INTERVALS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Próxima sincronización: {calculateNextSync()}
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bodega de Contífico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Bodega principal
            </label>
            <Select value={warehouse} onValueChange={setWarehouse} disabled={warehousesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={
                  warehousesLoading ? "Cargando bodegas..." :
                  warehousesError ? "Error al cargar bodegas" :
                  "Selecciona una bodega"
                } />
              </SelectTrigger>
              <SelectContent>
                {warehouses.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {warehousesLoading ? "Cargando..." : "No hay bodegas disponibles"}
                  </div>
                ) : (
                  warehouses.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nombre || w.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {warehousesError && (
              <p className="text-sm text-destructive">
                Error: {(warehousesError as Error).message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Los stocks se sincronizarán desde esta bodega
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Última sincronización</p>
              <p className="text-lg font-semibold text-foreground">
                {formatLastSync(stats?.lastSyncAt || null)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Productos sincronizados</p>
              <p className="text-lg font-semibold text-foreground">
                {stats?.totalProducts || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tasa de éxito</p>
              <p className="text-lg font-semibold text-foreground">
                {stats?.successRate || 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateConfigMutation.isPending}
          size="lg"
        >
          {updateConfigMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Settings className="mr-2 h-4 w-4" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
