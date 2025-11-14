import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "../../../dashboard-layout";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Package, FileText, ArrowLeft, Plus, Settings, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddIntegrationDialog } from "@/components/dashboard/add-integration-dialog";
import { EditIntegrationDialog } from "@/components/dashboard/edit-integration-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function ContificoModulesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Fetch Contífico integrations
  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      const res = await fetch('/api/integrations', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al cargar integraciones');
      const data = await res.json();
      // Filter only Contífico integrations
      return data.filter((int: Integration) =>
        int.integrationType === 'contifico'
      );
    },
  });

  // Delete integration mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/integrations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Integración eliminada",
        description: "La integración ha sido eliminada correctamente",
      });
      setDeleteDialogOpen(false);
      setSelectedIntegration(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (integration: Integration) => {
    setSelectedIntegration(integration);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedIntegration) {
      deleteMutation.mutate(selectedIntegration.id);
    }
  };

  const modules = [
    {
      id: "inventory",
      name: "Inventario",
      description: "Sincroniza productos y stock entre Contífico y tus tiendas online en tiempo real.",
      icon: Package,
      isAvailable: true,
      path: "/dashboard/integrations/contifico/inventory",
    },
    {
      id: "invoicing",
      name: "Facturación",
      description: "Genera facturas automáticamente desde tus pedidos online y envíalas a Contífico.",
      icon: FileText,
      isAvailable: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/dashboard/integrations")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Integraciones
        </Button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Contífico
              </h1>
              <p className="text-muted-foreground">
                Sistema ERP en la nube
              </p>
            </div>
          </div>
        </div>

        {/* Credentials Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configuración de Credenciales</CardTitle>
                <CardDescription>
                  Configura las credenciales de Contífico antes de usar los módulos
                </CardDescription>
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Integración
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : integrations && integrations.length > 0 ? (
              <div className="space-y-3">
                {integrations.map((integration) => {
                  const settings = integration.settings || {};
                  const env = settings.env || 'prod';
                  const hasApiKey = env === 'test'
                    ? settings.api_keys?.test
                    : settings.api_keys?.prod;

                  return (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{integration.name}</span>
                            {integration.isActive ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Activa
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Inactiva
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              Entorno: <span className="font-medium">{env === 'test' ? 'Pruebas' : 'Producción'}</span>
                            </span>
                            {settings.warehouse_primary && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-sm text-muted-foreground">
                                  Bodega: <span className="font-medium">{settings.warehouse_primary}</span>
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {hasApiKey ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                API Key configurada
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <XCircle className="h-3 w-3" />
                                API Key no configurada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(integration)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(integration)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">No hay integraciones configuradas</p>
                <p className="text-xs mt-1">Haz clic en "Agregar Integración" para comenzar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modules Section */}
        <div className="mt-8">
          <p className="text-muted-foreground text-lg mb-6">
            Selecciona el módulo que deseas gestionar
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {modules.map((module) => (
            <IntegrationCard
              key={module.id}
              name={module.name}
              description={module.description}
              icon={module.icon}
              isAvailable={module.isAvailable}
              onConfigure={() => {
                if (module.path) {
                  setLocation(module.path);
                }
              }}
            />
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-foreground mb-2">
            Módulos adicionales próximamente
          </h3>
          <p className="text-sm text-muted-foreground">
            Estamos trabajando en más integraciones con Contífico, incluyendo facturación electrónica,
            gestión de compras y reportes avanzados.
          </p>
        </div>
      </div>

      {/* Dialogs */}
      <AddIntegrationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <EditIntegrationDialog
        integration={selectedIntegration}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La integración "{selectedIntegration?.name}"
              será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}