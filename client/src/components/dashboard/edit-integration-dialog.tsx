import { useEffect } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const integrationSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contificoEnv: z.enum(["test", "prod"]),
  contificoApiKeyTest: z.string().optional(),
  contificoApiKeyProd: z.string().optional(),
  contificoWarehousePrimary: z.string().optional(),
  isActive: z.boolean(),
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

export function EditIntegrationDialog({ integration, open, onOpenChange }: EditIntegrationDialogProps) {
  const { toast } = useToast();

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
    }
  }, [integration, open, form]);

  const updateIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      if (!integration) throw new Error("No integration selected");

      const settings = {
        env: data.contificoEnv,
        api_keys: {
          test: data.contificoApiKeyTest || "",
          prod: data.contificoApiKeyProd || "",
        },
        warehouse_primary: data.contificoWarehousePrimary || "",
      };

      const payload = {
        name: data.name,
        settings,
        isActive: data.isActive,
      };

      const res = await apiRequest("PUT", `/api/integrations/${integration.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integración actualizada",
        description: "Los cambios se han guardado exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IntegrationFormData) => {
    updateIntegrationMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Integración</DialogTitle>
          <DialogDescription>
            Actualiza la configuración de tu integración
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
                <FormItem>
                  <FormLabel>Entorno</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="test">Pruebas</SelectItem>
                      <SelectItem value="prod">Producción</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contificoApiKeyTest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key (Pruebas)</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contificoApiKeyProd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key (Producción)</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contificoWarehousePrimary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bodega Principal</FormLabel>
                  <FormControl>
                    <Input placeholder="Dejar vacío para stock global" {...field} />
                  </FormControl>
                  <FormDescription>
                    ID de la bodega principal en Contífico
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateIntegrationMutation.isPending}>
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