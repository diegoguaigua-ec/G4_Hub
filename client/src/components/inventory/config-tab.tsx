import { useState } from "react";
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
  integrationName: string;
  syncConfig: {
    autoSync?: boolean;
    interval?: string;
    warehouse?: string;
  };
  isActive: boolean;
}

interface SyncStats {
  lastSyncAt: string | null;
  totalProducts: number;
  successRate: number;
}

const SYNC_INTERVALS = [
  { value: "5", label: "Cada 5 minutos" },
  { value: "15", label: "Cada 15 minutos" },
  { value: "30", label: "Cada 30 minutos" },
  { value: "60", label: "Cada 1 hora" },
  { value: "360", label: "Cada 6 horas" },
  { value: "720", label: "Cada 12 horas" },
  { value: "1440", label: "Cada 24 horas" },
];

export function ConfigTab({ storeId }: ConfigTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoSync, setAutoSync] = useState(false);
  const [interval, setInterval] = useState("15");
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
    onSuccess: (data) => {
      // Pre-populate form with existing config
      const contificoIntegration = data.find((i) =>
        i.integrationName.toLowerCase().includes("contífico") ||
        i.integrationName.toLowerCase().includes("contifico")
      );
      if (contificoIntegration?.syncConfig) {
        setAutoSync(contificoIntegration.syncConfig.autoSync || false);
        setInterval(contificoIntegration.syncConfig.interval || "15");
        setWarehouse(contificoIntegration.syncConfig.warehouse || "");
      }
    },
  });

  // Fetch warehouses (stubbed for now - will be implemented in backend)
  const { data: warehouses = [] } = useQuery({
    queryKey: [`/api/integrations/warehouses`],
    queryFn: async () => {
      // TODO: Implement endpoint /api/integrations/:id/warehouses
      return [
        { id: "1", name: "Bodega Principal" },
        { id: "2", name: "Bodega Secundaria" },
      ];
    },
    enabled: false, // Disable until backend endpoint exists
  });

  // Fetch sync stats (stubbed for now)
  const { data: stats } = useQuery<SyncStats>({
    queryKey: [`/api/stores/${storeId}/sync-stats`],
    queryFn: async () => {
      // TODO: Implement endpoint to get sync stats
      return {
        lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        totalProducts: 145,
        successRate: 98.5,
      };
    },
    enabled: false, // Disable until backend endpoint exists
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const contificoIntegration = integrations.find((i) =>
        i.integrationName.toLowerCase().includes("contífico") ||
        i.integrationName.toLowerCase().includes("contifico")
      );

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
      autoSync,
      interval,
      warehouse,
    });
  };

  const calculateNextSync = () => {
    if (!autoSync || !stats?.lastSyncAt) return "N/A";
    const lastSync = new Date(stats.lastSyncAt);
    const intervalMinutes = parseInt(interval);
    const nextSync = new Date(lastSync.getTime() + intervalMinutes * 60 * 1000);

    const now = new Date();
    const diff = nextSync.getTime() - now.getTime();
    const minutesLeft = Math.round(diff / (60 * 1000));

    if (minutesLeft < 0) return "Ahora";
    if (minutesLeft < 60) return `En ${minutesLeft} min`;
    const hoursLeft = Math.floor(minutesLeft / 60);
    return `En ${hoursLeft}h ${minutesLeft % 60}min`;
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
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una bodega" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          disabled={updateConfigMutation.isLoading}
          size="lg"
        >
          {updateConfigMutation.isLoading ? (
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
