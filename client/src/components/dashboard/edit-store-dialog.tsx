import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Database, Plug, RefreshCw } from "lucide-react";
import { z } from "zod";
import { Store } from "@shared/schema";
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
import { SyncProgressDialog } from "./sync-progress-dialog";

// Form schema
const editStoreFormSchema = z
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
    shopDomain: z.string().optional(),
    // Contífico credentials
    username: z.string().optional(),
    password: z.string().optional(),
    apiUrl: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.platform === "woocommerce") {
        return data.consumerKey && data.consumerSecret;
      }
      if (data.platform === "shopify") {
        return data.apiKey && data.accessToken;
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

type EditStoreFormData = z.infer<typeof editStoreFormSchema>;

interface Integration {
  id: number;
  name: string;
  integrationType: string;
  isActive: boolean;
  settings: any;
}

interface StoreIntegration {
  id: number;
  storeId: number;
  integrationId: number;
  isActive: boolean;
  syncConfig: any;
}

interface EditStoreDialogProps {
  store: Store | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStoreDialog({
  store,
  open,
  onOpenChange,
}: EditStoreDialogProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const form = useForm<EditStoreFormData>({
    resolver: zodResolver(editStoreFormSchema),
    defaultValues: {
      storeName: "",
      storeUrl: "",
      platform: "shopify",
      consumerKey: "",
      consumerSecret: "",
      apiKey: "",
      accessToken: "",
      shopDomain: "",
      username: "",
      password: "",
      apiUrl: "",
    },
  });

  // Cargar integraciones disponibles
  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    enabled: open,
  });

  // Cargar integraciones vinculadas a esta tienda
  const { data: storeIntegrations = [] } = useQuery<StoreIntegration[]>({
    queryKey: [`/api/stores/${store?.id}/integrations`],
    enabled: !!store?.id && open,
  });

  // Update form values when store changes
  useEffect(() => {
    if (store && open) {
      const credentials = (store.apiCredentials as any) || {};

      form.reset({
        storeName: store.storeName,
        storeUrl: store.storeUrl,
        platform: store.platform as any,
        consumerKey: credentials.consumer_key || "",
        consumerSecret: credentials.consumer_secret || "",
        apiKey: credentials.api_key || "",
        accessToken: credentials.access_token || "",
        shopDomain: credentials.shop_domain || "",
        username: credentials.username || "",
        password: credentials.password || "",
        apiUrl: credentials.api_url || "",
      });
    }
  }, [store, open, form]);

  const updateStoreMutation = useMutation({
    mutationFn: async (data: EditStoreFormData) => {
      if (!store) throw new Error("No store selected");

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

      const res = await apiRequest("PUT", `/api/stores/${store.id}`, {
        storeName: data.storeName,
        storeUrl: data.storeUrl,
        platform: data.platform,
        apiCredentials,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Tienda actualizada",
        description: "Los cambios se guardaron correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar tienda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error("No store selected");
      const res = await apiRequest("DELETE", `/api/stores/${store.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Tienda eliminada",
        description: "La tienda ha sido eliminada correctamente",
      });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar tienda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Vincular integración
  const linkMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      if (!store?.id) throw new Error("No store selected");
      const res = await apiRequest(
        "POST",
        `/api/stores/${store.id}/integrations/${integrationId}`,
        { syncConfig: { pull: { enabled: false } } },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${store?.id}/integrations`],
      });
      toast({
        title: "Integración vinculada",
        description: "La integración se vinculó correctamente a la tienda",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al vincular",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Desvincular integración
  const unlinkMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      if (!store?.id) throw new Error("No store selected");
      const res = await apiRequest(
        "DELETE",
        `/api/stores/${store.id}/integrations/${integrationId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${store?.id}/integrations`],
      });
      toast({
        title: "Integración desvinculada",
        description: "La sincronización ha sido deshabilitada",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al desvincular",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle estado de sincronización
  const toggleSyncMutation = useMutation({
    mutationFn: async ({
      linkId,
      isActive,
    }: {
      linkId: number;
      isActive: boolean;
    }) => {
      if (!store?.id) throw new Error("No store selected");

      // Encontrar la integración correspondiente
      const link = storeIntegrations.find((si) => si.id === linkId);
      if (!link) throw new Error("Link not found");

      const res = await apiRequest(
        "PUT",
        `/api/stores/${store.id}/integrations/${link.integrationId}`,
        {
          isActive,
          syncConfig: link.syncConfig,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${store?.id}/integrations`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar estado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sincronizar ahora (Pull manual)
  const syncNowMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      if (!store?.id) throw new Error("No store selected");

      const res = await apiRequest(
        "POST",
        `/api/sync/pull/${store.id}/${integrationId}`,
        { dryRun: false, limit: 1000 },
      );
      return res.json();
    },
    onMutate: () => {
      // ✅ Abrir modal al iniciar
      setSyncDialogOpen(true);
      setSyncResult(null);
    },
    onSuccess: (data) => {
      // ✅ Guardar resultados
      setSyncResult(data.result);

      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${store?.id}/integrations`],
      });

      toast({
        title: "Sincronización completada",
        description: `${data.result.success} productos actualizados exitosamente`,
      });
    },
    onError: (error: Error) => {
      // ✅ Guardar error en formato de resultado
      setSyncResult({
        success: 0,
        failed: 1,
        skipped: 0,
        errors: [{ sku: "unknown", error: error.message }],
      });

      toast({
        title: "Error al sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditStoreFormData) => {
    updateStoreMutation.mutate(data);
  };

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
                  <FormLabel>Consumer Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ck_..."
                      data-testid="input-consumer-key"
                      {...field}
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
                  <FormLabel>Consumer Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="cs_..."
                      data-testid="input-consumer-secret"
                      {...field}
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
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="API Key de Shopify"
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
                  <FormLabel>Access Token</FormLabel>
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
              name="shopDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Domain</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="tutienda.myshopify.com"
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
                      placeholder="usuario"
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
                      placeholder="********"
                      data-testid="input-password"
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
                  <FormLabel>API URL</FormLabel>
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

  if (!store) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tienda</DialogTitle>
            <DialogDescription>
              Actualiza la configuración de tu tienda conectada
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
                    <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Credenciales API
                </div>
                {renderCredentialFields()}
              </div>

              {/* SECCIÓN DE INTEGRACIONES */}
              <Separator className="my-6" />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Integraciones de Gestión
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Vincula Contífico u otros sistemas para sincronizar
                    inventario
                  </p>
                </div>

                {integrations.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No tienes integraciones configuradas.{" "}
                      <span className="text-primary underline cursor-pointer">
                        Ve a la sección Integraciones para configurar una
                      </span>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {integrations.map((integration) => {
                      const isLinked = storeIntegrations.some(
                        (si) => si.integrationId === integration.id,
                      );
                      const link = storeIntegrations.find(
                        (si) => si.integrationId === integration.id,
                      );

                      return (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Plug className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{integration.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {integration.integrationType}
                                {!integration.isActive && " (Inactiva)"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isLinked && link ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    Sincronización
                                  </span>
                                  <Switch
                                    checked={link.isActive}
                                    onCheckedChange={(checked) =>
                                      toggleSyncMutation.mutate({
                                        linkId: link.id,
                                        isActive: checked,
                                      })
                                    }
                                    disabled={toggleSyncMutation.isPending}
                                  />
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    syncNowMutation.mutate(integration.id)
                                  }
                                  disabled={
                                    syncNowMutation.isPending || !link.isActive
                                  }
                                  title="Sincronizar inventario ahora"
                                >
                                  {syncNowMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    unlinkMutation.mutate(integration.id)
                                  }
                                  disabled={unlinkMutation.isPending}
                                >
                                  {unlinkMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Desvincular"
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() =>
                                  linkMutation.mutate(integration.id)
                                }
                                disabled={
                                  linkMutation.isPending ||
                                  !integration.isActive
                                }
                              >
                                {linkMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Vincular"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={
                    updateStoreMutation.isPending ||
                    deleteStoreMutation.isPending
                  }
                  data-testid="button-delete-store"
                  className="text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/30"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Tienda
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={
                    updateStoreMutation.isPending ||
                    deleteStoreMutation.isPending
                  }
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    updateStoreMutation.isPending ||
                    deleteStoreMutation.isPending
                  }
                  data-testid="button-save-store"
                >
                  {updateStoreMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la tienda "{store.storeName}
              " y todos sus datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStoreMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStoreMutation.mutate()}
              disabled={deleteStoreMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteStoreMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar Tienda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SyncProgressDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        syncResult={syncResult}
        isLoading={syncNowMutation.isPending}
      />
    </>
  );
}
