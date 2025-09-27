import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { z } from "zod";
import { Store } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Form schema with individual credential fields (same as add store)
const editStoreFormSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(255, "Store name too long"),
  storeUrl: z.string().url("Must be a valid URL"),
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
}).refine((data) => {
  // Validate that required fields for each platform are provided
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
}, {
  message: "Please fill in all required credential fields for the selected platform",
  path: ["credentials"]
});

type EditStoreFormData = z.infer<typeof editStoreFormSchema>;

interface EditStoreDialogProps {
  store: Store | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStoreDialog({ store, open, onOpenChange }: EditStoreDialogProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<EditStoreFormData>({
    resolver: zodResolver(editStoreFormSchema),
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
      shopDomain: "",
      // Contífico
      username: "",
      password: "",
      apiUrl: "",
    },
  });

  // Update form values when store changes
  useEffect(() => {
    if (store && open) {
      const credentials = store.apiCredentials as any || {};
      
      form.reset({
        storeName: store.storeName,
        storeUrl: store.storeUrl,
        platform: store.platform as any,
        // WooCommerce
        consumerKey: credentials.consumer_key || "",
        consumerSecret: credentials.consumer_secret || "",
        // Shopify
        apiKey: credentials.api_key || "",
        accessToken: credentials.access_token || "",
        shopDomain: credentials.shop_domain || "",
        // Contífico
        username: credentials.username || "",
        password: credentials.password || "",
        apiUrl: credentials.api_url || "",
      });
    }
  }, [store, open, form]);

  const updateStoreMutation = useMutation({
    mutationFn: async (data: EditStoreFormData) => {
      if (!store) throw new Error("No store selected");
      
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
        syncConfig: {}
      };
      
      const res = await apiRequest("PUT", `/api/stores/${store.id}`, storeData);
      return res.json();
    },
    onSuccess: (updatedStore) => {
      toast({
        title: "Store updated successfully",
        description: `${updatedStore.store.storeName} has been updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update store",
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
      toast({
        title: "Store deleted successfully",
        description: `${store?.storeName} has been removed from your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete store",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditStoreFormData) => {
    updateStoreMutation.mutate(data);
  };

  const handleDelete = () => {
    deleteStoreMutation.mutate();
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
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="your_username" 
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="your_password" 
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
            <DialogDescription>
              Update your store connection details and credentials.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-platform">
                          <SelectValue placeholder="Select your e-commerce platform" />
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
                    <FormLabel>Store URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://yourstore.myshopify.com" 
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
                    <FormLabel>Store Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="My Awesome Store" 
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
                  API Credentials
                </div>
                {renderCredentialFields()}
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={updateStoreMutation.isPending || deleteStoreMutation.isPending}
                  data-testid="button-delete-store"
                  className="text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/30"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Store
                </Button>
                <div className="flex-1" />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={updateStoreMutation.isPending || deleteStoreMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateStoreMutation.isPending || deleteStoreMutation.isPending}
                  data-testid="button-save-store"
                >
                  {updateStoreMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Store"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{store?.storeName}"? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteStoreMutation.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStoreMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Store"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}