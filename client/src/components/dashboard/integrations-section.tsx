import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Plus, Settings, Trash2, RefreshCw, CheckCircle, XCircle, Database, Package } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { EditIntegrationDialog } from "./edit-integration-dialog";

interface Integration {
  id: number;
  tenantId: number;
  integrationType: string;
  name: string;
  settings: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function IntegrationsSection() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Fetch integrations
  const { data: integrations = [], isLoading, error } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const res = await apiRequest("POST", `/api/integrations/${integrationId}/test-connection`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Conexión exitosa",
          description: data.details?.message || "La integración está funcionando correctamente.",
        });
      } else {
        toast({
          title: "Error de conexión",
          description: data.error || "No se pudo conectar con la integración",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const res = await apiRequest("DELETE", `/api/integrations/${integrationId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integración eliminada",
        description: "La integración ha sido eliminada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'contifico':
        return Database;
      default:
        return Plug;
    }
  };

  const getIntegrationTypeLabel = (type: string) => {
    switch (type) {
      case 'contifico':
        return 'Contífico ERP';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600">Error al cargar integraciones</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Integraciones</h2>
          <p className="text-muted-foreground">Conecta con sistemas de gestión y facturación</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-integration">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Integración
        </Button>
      </div>

      {/* Integrations Grid */}
      {integrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Plug className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No hay integraciones configuradas</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Conecta Contífico u otros sistemas para sincronizar inventario y gestionar tu negocio de forma centralizada
            </p>
            <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-first-integration">
              <Plus className="h-4 w-4 mr-2" />
              Configurar Primera Integración
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => {
            const IntegrationIcon = getIntegrationIcon(integration.integrationType);

            return (
              <Card key={integration.id} className="border border-border hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <IntegrationIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getIntegrationTypeLabel(integration.integrationType)}
                        </p>
                      </div>
                    </div>
                    {integration.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* Settings preview */}
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <div className="text-sm space-y-1">
                      {integration.integrationType === 'contifico' && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Entorno:</span>
                            <span className="font-medium flex items-center gap-1">
                              {integration.settings?.env === 'test' ? (
                                <>
                                  <Package className="h-3 w-3" />
                                  Pruebas
                                </>
                              ) : (
                                <>
                                  <Database className="h-3 w-3" />
                                  Producción
                                </>
                              )}
                            </span>
                          </div>
                          {integration.settings?.warehouse_primary && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bodega:</span>
                              <span className="font-medium">{integration.settings.warehouse_primary}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={testConnectionMutation.isPending}
                      onClick={() => testConnectionMutation.mutate(integration.id)}
                      data-testid={`button-test-${integration.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                      Probar
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setEditDialogOpen(true);
                      }}
                      data-testid={`button-edit-${integration.id}`}
                      title="Editar integración"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm(`¿Eliminar la integración "${integration.name}"?`)) {
                          deleteIntegrationMutation.mutate(integration.id);
                        }
                      }}
                      data-testid={`button-delete-${integration.id}`}
                      title="Eliminar integración"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddIntegrationDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      <EditIntegrationDialog
        integration={selectedIntegration}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedIntegration(null);
          }
        }}
      />
    </div>
  );
}