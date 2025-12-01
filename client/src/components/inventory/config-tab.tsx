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
import { Settings, Clock, Database, Loader2, Info } from "lucide-react";
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
      interval?: '5min' | '30min' | 'hourly' | 'daily' | 'weekly';
      warehouse?: string;
    };
  };
  isActive: boolean;
}

const SYNC_INTERVALS = [
  { value: "5min", label: "Cada 5 minutos", syncsPerMonth: "~8,640 syncs/mes" },
  { value: "30min", label: "Cada 30 minutos", syncsPerMonth: "~1,440 syncs/mes" },
  { value: "hourly", label: "Cada hora", syncsPerMonth: "~720 syncs/mes" },
  { value: "daily", label: "Cada día", syncsPerMonth: "~30 syncs/mes" },
  { value: "weekly", label: "Cada semana", syncsPerMonth: "~4 syncs/mes" },
];

export function ConfigTab({ storeId }: ConfigTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoSync, setAutoSync] = useState(false);
  const [interval, setInterval] = useState<'5min' | '30min' | 'hourly' | 'daily' | 'weekly'>("daily");
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
          <AlertDescription className="space-y-2">
            <p>
              No se encontró una integración de Contífico configurada para esta tienda.
            </p>
            <p className="font-medium">
              Para configurar Contífico:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
              <li>Ve a la sección <strong>"Integraciones"</strong> en el menú lateral</li>
              <li>Haz clic en <strong>"Agregar Integración"</strong></li>
              <li>Ingresa tu API Key de Contífico</li>
              <li>Selecciona el ambiente (Producción o Prueba)</li>
              <li>Elige la bodega principal</li>
              <li>Luego vincula la integración con esta tienda</li>
            </ol>
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
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.syncsPerMonth}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
