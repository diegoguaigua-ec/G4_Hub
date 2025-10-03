import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { z } from "zod";

const integrationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contificoEnv: z.enum(["test", "prod"]),
  contificoApiKeyTest: z.string().optional(),
  contificoApiKeyProd: z.string().optional(),
  contificoWarehousePrimary: z.string().optional(),
  isActive: z.boolean(),
}).refine((data) => {
  // Validar que la API Key del entorno seleccionado esté presente
  if (data.contificoEnv === "test") {
    return data.contificoApiKeyTest && data.contificoApiKeyTest.trim() !== "";
  } else {
    return data.contificoApiKeyProd && data.contificoApiKeyProd.trim() !== "";
  }
}, {
  message: "API Key es requerida para el entorno seleccionado",
  path: ["contificoApiKeyTest"],
});

type IntegrationFormData = z.infer<typeof integrationSchema>;

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

interface EditIntegrationDialogProps {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Warehouse {
  id: string;
  name: string;
}

export function EditIntegrationDialog({ 
  integration, 
  open, 
  onOpenChange 
}: EditIntegrationDialogProps) {
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: "",
      contificoEnv: "prod",
      contificoApiKeyTest: "",
      contificoApiKeyProd: "",
      contificoWarehousePrimary: "",
      isActive: true,
    },
  });

  // Cargar datos de la integración cuando se abre el diálogo
  useEffect(() => {
    if (integration && open) {
      const settings = integration.settings || {};

      form.reset({
        name: integration.name,
        contificoEnv: settings.env || "prod",
        contificoApiKeyTest: settings.api_keys?.test || "",
        contificoApiKeyProd: settings.api_keys?.prod || "",
        contificoWarehousePrimary: settings.warehouse_primary || "",
        isActive: integration.isActive,
      });

      // Cargar bodegas automáticamente al abrir
      loadWarehouses();
    }
  }, [integration, open]);

  // Función para cargar bodegas
  const loadWarehouses = async () => {
    if (!integration) return;

    setIsLoadingWarehouses(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/integrations/${integration.id}/test-connection`
      );
      const result = await res.json();

      if (result.success && result.details?.warehouses) {
        setWarehouses(result.details.warehouses);
      } else {
        throw new Error(result.error || result.message || "No se pudieron cargar las bodegas");
      }
    } catch (error: any) {
      toast({
        title: "Error al cargar bodegas",
        description: error.message,
        variant: "destructive"
      });
      setWarehouses([]);
    } finally {
      setIsLoadingWarehouses(false);
    }
  };

  const updateIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      if (!integration) throw new Error("No integration selected");

      // Construir settings actualizados
      const apiKeys = {
        test: data.contificoApiKeyTest || "",
        prod: data.contificoApiKeyProd || ""
      };

      // Convertir "global" a undefined para stock global
      const warehouseValue = data.contificoWarehousePrimary === "global" 
        ? undefined 
        : data.contificoWarehousePrimary || undefined;

      const updatedSettings = {
        env: data.contificoEnv,
        api_keys: apiKeys,
        warehouse_primary: warehouseValue
      };

      const res = await apiRequest("PUT", `/api/integrations/${integration.id}`, {
        name: data.name,
        settings: updatedSettings,
        isActive: data.isActive
      });

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integración actualizada",
        description: "Los cambios se guardaron correctamente"
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: IntegrationFormData) => {
    updateIntegrationMutation.mutate(data);
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Integración</DialogTitle>
          <DialogDescription>
            Actualiza la configuración de tu integración con Contífico
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contificoEnv"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Entorno</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="test" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Pruebas (Test)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="prod" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Producción
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mostrar solo el campo de API Key del entorno seleccionado */}
            {form.watch("contificoEnv") === "test" && (
              <FormField
                control={form.control}
                name="contificoApiKeyTest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key (Pruebas)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="API Key de pruebas"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Tu API Key del entorno de pruebas de Contífico
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("contificoEnv") === "prod" && (
              <FormField
                control={form.control}
                name="contificoApiKeyProd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key (Producción)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="API Key de producción"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Tu API Key del entorno de producción de Contífico
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Sección de Bodega con botón de recarga */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Bodega Principal</FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadWarehouses}
                  disabled={isLoadingWarehouses}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingWarehouses ? 'animate-spin' : ''}`} />
                  Recargar Bodegas
                </Button>
              </div>

              {warehouses.length > 0 && (
                <Alert className="mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Bodegas Disponibles</AlertTitle>
                  <AlertDescription>
                    {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} encontrada{warehouses.length !== 1 ? 's' : ''} en Contífico
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="contificoWarehousePrimary"
                render={({ field }) => (
                  <FormItem>
                    <Select 
                      onValueChange={field.onChange}
                      value={field.value || "global"}
                      disabled={warehouses.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue 
                            placeholder={
                              warehouses.length === 0 
                                ? "Carga las bodegas para seleccionar" 
                                : "Seleccionar bodega o dejar vacío para stock global"
                            } 
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="global">Stock global (todas las bodegas)</SelectItem>
                        {warehouses.map((warehouse) => (
                          <SelectItem 
                            key={warehouse.id} 
                            value={warehouse.id}
                          >
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Si seleccionas una bodega, solo se sincronizará el stock de esa ubicación
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateIntegrationMutation.isPending}
              >
                {updateIntegrationMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}