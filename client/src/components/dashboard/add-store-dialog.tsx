import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

// Form schema with individual credential fields
const addStoreFormSchema = z.object({
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
      
      const res = await apiRequest("POST", "/api/stores", storeData);
      return res.json();
    },
    onSuccess: (response) => {
      // Handle different response types based on automatic connection test
      const { store, connection, message } = response;
      
      if (connection?.success) {
        toast({
          title: "Store connected successfully",
          description: `${store.storeName} is now connected and ready to sync.`,
        });
      } else {
        toast({
          title: "Store created with connection issues",
          description: `${store.storeName} was added but connection failed: ${connection?.error || 'Unknown error'}`,
          variant: "destructive",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add store",
        description: error.message,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Store</DialogTitle>
          <DialogDescription>
            Connect your e-commerce store to start automating your operations.
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            {/* Connection testing is automatic - no manual testing needed */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              💡 Your store connection will be tested automatically when you add it.
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={createStoreMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createStoreMutation.isPending}
                data-testid="button-save-store"
              >
                {createStoreMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding & Testing Store...
                  </>
                ) : (
                  "Add Store"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}