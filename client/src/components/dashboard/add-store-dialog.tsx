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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

// Form schema with individual credential fields
const addStoreFormSchema = z
  .object({
    storeName: z
      .string()
      .min(1, "El nombre de tienda es requerido")
      .max(255, "Nombre de tienda muy largo"),
    storeUrl: z.string().url("Debe ser una URL válida"),
    platform: z.enum(["woocommerce", "shopify", "contifico"]),
    // WooCommerce credentials
    consumerKey: z.string().optional(),
    consumerSecret: z.string().optional(),
    // Shopify credentials
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    apiSecret: z.string().optional(),
    shopDomain: z.string().optional(),
    // Contífico credentials
    username: z.string().optional(),
    password: z.string().optional(),
    apiUrl: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate that required fields for each platform are provided
      if (data.platform === "woocommerce") {
        return data.consumerKey && data.consumerSecret;
      }
      if (data.platform === "shopify") {
        return data.apiKey && data.accessToken && data.apiSecret;
      }
      if (data.platform === "contifico") {
        return data.username && data.password && data.apiUrl;
      }
      return true;
    },
    {
      message:
        "Por favor completa todos los campos de credenciales requeridos para la plataforma seleccionada",
      path: ["credentials"],
    },
  );

type AddStoreFormData = z.infer<typeof addStoreFormSchema>;

interface AddStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStoreDialog({ open, onOpenChange }: AddStoreDialogProps) {
  const { toast } = useToast();

  const form = useForm<AddStoreFormData>({
    resolver: zodResolver(addStoreFormSchema),
    defaultValues: {
      storeName: "",
      storeUrl: "",
      platform: "shopify",
      // WooCommerce
      consumerKey: "",
      consumerSecret: "",
      // Shopify
      apiKey: "",
      accessToken: "",
      apiSecret: "",
      shopDomain: "",
      // Contífico
      username: "",
      password: "",
      apiUrl: "",
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: AddStoreFormData) => {
      // Format credentials based on platform
      let apiCredentials: any = {};

      switch (data.platform) {
        case "woocommerce":
          apiCredentials = {
            consumer_key: data.consumerKey,
            consumer_secret: data.consumerSecret,
          };
          break;
        case "shopify":
          apiCredentials = {
            api_key: data.apiKey,
            access_token: data.accessToken,
            api_secret: data.apiSecret,
            shop_domain: data.shopDomain,
          };
          break;
        case "contifico":
          apiCredentials = {
            username: data.username,
            password: data.password,
            api_url: data.apiUrl,
          };
          break;
      }

      const storeData = {
        storeName: data.storeName,
        storeUrl: data.storeUrl,
        platform: data.platform,
        apiCredentials,
        syncConfig: {},
      };

      const res = await apiRequest("POST", "/api/stores", storeData);
      return res.json();
    },
    onSuccess: (response) => {
      // Handle different response types based on automatic connection test
      const { store, connection, message } = response;

      if (connection?.success) {
        toast({
          title: "Tienda conectada exitosamente",
          description: `${store.storeName} está ahora conectada y lista para sincronizar.`,
        });
      } else {
        toast({
          title: "Tienda creada con problemas de conexión",
          description: `${store.storeName} fue agregada pero la conexión falló. Verifica tus credenciales.`,
          variant: "destructive",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al agregar tienda",
        description:
          "No se pudo agregar la tienda. Verifica tus credenciales e intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Note: Connection testing is now automatic when creating stores
  // No need for manual testing - the backend tests immediately upon creation

  const onSubmit = (data: AddStoreFormData) => {
    createStoreMutation.mutate(data);
  };

  // Helper function to render platform-specific credential fields
  const renderCredentialFields = () => {
    const platform = form.watch("platform");

    switch (platform) {
      case "woocommerce":
        return (
          <>
            <FormField
              control={form.control}
              name="consumerKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clave de Consumidor</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ck_..."
                      data-testid="input-consumer-key"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="consumerSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secreto de Consumidor</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="cs_..."
                      data-testid="input-consumer-secret"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "shopify":
        return (
          <>
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clave API</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your_api_key"
                      data-testid="input-api-key"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token de Acceso</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="shpat_..."
                      data-testid="input-access-token"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="shpss_..."
                      data-testid="input-api-secret"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shopDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dominio de Tienda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="yourstore.myshopify.com"
                      data-testid="input-shop-domain"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "contifico":
        return (
          <>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="tu_usuario"
                      data-testid="input-username"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="tu_contraseña"
                      data-testid="input-api-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL API</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://api.contifico.com"
                      data-testid="input-api-url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Tienda</DialogTitle>
          <DialogDescription>
            Conecta tu tienda online para comenzar a automatizar tus
            operaciones.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-platform">
                        <SelectValue placeholder="Selecciona tu plataforma de comercio electrónico" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="shopify">Shopify</SelectItem>
                      <SelectItem value="woocommerce">WooCommerce</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storeUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de Tienda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://tutienda.myshopify.com"
                      data-testid="input-store-url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de Tienda</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Mi Tienda Increíble"
                      data-testid="input-store-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Platform-specific credential fields */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground">
                Credenciales API
              </div>
              {renderCredentialFields()}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createStoreMutation.isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createStoreMutation.isPending}
                data-testid="button-save-store"
              >
                {createStoreMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agregando y Probando Tienda...
                  </>
                ) : (
                  "Agregar Tienda"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
