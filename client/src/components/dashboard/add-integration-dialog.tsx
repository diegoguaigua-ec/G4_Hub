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
  integrationType: z.enum(["contifico"]),
  contificoEnv: z.enum(["test", "prod"]),
  contificoApiKeyTest: z.string().optional(),
  contificoApiKeyProd: z.string().optional(),
  contificoWarehousePrimary: z.string().optional(),
}).refine((data) => {
  if (data.integrationType === "contifico") {
    const env = data.contificoEnv;
    if (env === "test") {
      return data.contificoApiKeyTest && data.contificoApiKeyTest.trim() !== "";
    } else {
      return data.contificoApiKeyProd && data.contificoApiKeyProd.trim() !== "";
    }
  }
  return true;
}, {
  message: "API Key es requerida para el entorno seleccionado",
  path: ["contificoApiKeyTest"],
});

type IntegrationFormData = z.infer<typeof integrationSchema>;

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddIntegrationDialog({ open, onOpenChange }: AddIntegrationDialogProps) {
  const { toast } = useToast();

  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: "",
      integrationType: "contifico",
      contificoEnv: "prod",
      contificoApiKeyTest: "",
      contificoApiKeyProd: "",
      contificoWarehousePrimary: "",
    },
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      const settings = {
        env: data.contificoEnv,
        api_keys: {
          test: data.contificoApiKeyTest || "",
          prod: data.contificoApiKeyProd || "",
        },
        warehouse_primary: data.contificoWarehousePrimary || "",
      };

      const payload = {
        integrationType: data.integrationType,
        name: data.name,
        settings,
      };

      const res = await apiRequest("POST", "/api/integrations", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integración creada",
        description: "La integración se ha configurado exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear integración",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IntegrationFormData) => {
    createIntegrationMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar Integración</DialogTitle>
          <DialogDescription>
            Configura una nueva integración con sistemas externos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Input type="password" placeholder="API Key de pruebas" {...field} />
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
                    <Input type="password" placeholder="API Key de producción" {...field} />
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
                  <FormLabel>Bodega Principal (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="ID de bodega" {...field} />
                  </FormControl>
                  <FormDescription>
                    Dejar vacío para usar stock global
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createIntegrationMutation.isPending}>
                {createIntegrationMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear Integración
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}