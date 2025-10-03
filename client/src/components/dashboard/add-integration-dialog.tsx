import { useState } from "react";
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
import { Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";

// Schema actualizado para flujo en 2 pasos
const integrationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  integrationType: z.enum(["contifico"]),
  contificoEnv: z.enum(["test", "prod"]),
  contificoApiKeyTest: z.string().optional(),
  contificoApiKeyProd: z.string().optional(),
  contificoWarehousePrimary: z.string().optional(),
}).refine((data) => {
  // Validar que la API Key del entorno seleccionado esté presente
  if (data.contificoEnv === "test") {
    return data.contificoApiKeyTest && data.contificoApiKeyTest.trim() !== "";
  } else {
    return data.contificoApiKeyProd && data.contificoApiKeyProd.trim() !== "";
  }
}, {
  message: "API Key es requerida para el entorno seleccionado",
  path: ["contificoApiKeyTest"], // Path genérico para mostrar error
});

type IntegrationFormData = z.infer<typeof integrationSchema>;

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Warehouse {
  id: string;
  name: string;
}

export function AddIntegrationDialog({ open, onOpenChange }: AddIntegrationDialogProps) {
  const { toast } = useToast();

  // Estados para el flujo en 2 pasos
  const [step, setStep] = useState<'config' | 'warehouse'>('config');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [integrationId, setIntegrationId] = useState<number | null>(null);

  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: "",
      integrationType: "contifico",
      contificoEnv: "test",
      contificoApiKeyTest: "",
      contificoApiKeyProd: "",
      contificoWarehousePrimary: "global",
    },
  });

  // Mutation 1: Crear integración y probar conexión
  const createMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      // Solo enviar API Key del entorno seleccionado
      const apiKeys = {
        test: data.contificoEnv === 'test' ? data.contificoApiKeyTest : '',
        prod: data.contificoEnv === 'prod' ? data.contificoApiKeyProd : ''
      };

      const payload = {
        integrationType: 'contifico',
        name: data.name,
        settings: {
          env: data.contificoEnv,
          api_keys: apiKeys
        }
      };

      // Crear integración
      const createRes = await apiRequest("POST", "/api/integrations", payload);
      const integration = await createRes.json();

      // Probar conexión
      const testRes = await apiRequest(
        "POST",
        `/api/integrations/${integration.id}/test-connection`
      );
      const testResult = await testRes.json();

      if (!testResult.success) {
        throw new Error(testResult.error || testResult.message || "Error al conectar con Contífico");
      }

      return {
        integration,
        warehouses: testResult.details?.warehouses || []
      };
    },
    onSuccess: (data) => {
      setIntegrationId(data.integration.id);
      setWarehouses(data.warehouses);
      setStep('warehouse');

      toast({
        title: "Conexión exitosa",
        description: `Se encontraron ${data.warehouses.length} bodegas disponibles`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear integración",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation 2: Actualizar con bodega seleccionada
  const updateWarehouseMutation = useMutation({
    mutationFn: async (warehouseId: string) => {
      if (!integrationId) throw new Error("No integration ID");

      // Obtener integración actual para preservar settings
      const getRes = await apiRequest("GET", `/api/integrations/${integrationId}`);
      const currentIntegration = await getRes.json();

      // Convertir "global" a undefined
      const warehouseValue = warehouseId === "global" ? undefined : warehouseId || undefined;

      const updatedSettings = {
        ...currentIntegration.settings,
        warehouse_primary: warehouseValue
      };

      const res = await apiRequest("PUT", `/api/integrations/${integrationId}`, {
        settings: updatedSettings
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integración configurada",
        description: "La integración está lista para usar"
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al configurar bodega",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmitStep1 = (data: IntegrationFormData) => {
    createMutation.mutate(data);
  };

  const onSubmitStep2 = () => {
    const warehouseId = form.getValues("contificoWarehousePrimary") || "global";
    updateWarehouseMutation.mutate(warehouseId);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset después de un pequeño delay para evitar flash
    setTimeout(() => {
      form.reset();
      setStep('config');
      setWarehouses([]);
      setIntegrationId(null);
    }, 200);
  };

  const handleBack = () => {
    setStep('config');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'config' ? 'Nueva Integración' : 'Seleccionar Bodega'}
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? 'Configura la conexión con Contífico'
              : 'Elige la bodega principal para sincronización de inventario'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* PASO 1: Configuración */}
          {step === 'config' && (
            <form onSubmit={form.handleSubmit(onSubmitStep1)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Mi integración Contífico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="integrationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Integración</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="contifico">Contífico ERP</SelectItem>
                      </SelectContent>
                    </Select>
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

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear y Probar Conexión
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* PASO 2: Selección de Bodega */}
          {step === 'warehouse' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Conexión Exitosa</AlertTitle>
                <AlertDescription>
                  Se encontraron {warehouses.length} bodegas disponibles en tu cuenta de Contífico
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="contificoWarehousePrimary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bodega Principal (Opcional)</FormLabel>
                    <Select 
                      onValueChange={field.onChange}
                      value={field.value || "global"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar bodega o dejar vacío para stock global" />
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

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleBack}
                  disabled={updateWarehouseMutation.isPending}
                >
                  Atrás
                </Button>
                <Button 
                  type="button"
                  onClick={onSubmitStep2}
                  disabled={updateWarehouseMutation.isPending}
                >
                  {updateWarehouseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Finalizar Configuración
                </Button>
              </DialogFooter>
            </div>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}