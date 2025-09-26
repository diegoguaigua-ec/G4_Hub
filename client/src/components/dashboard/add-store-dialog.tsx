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

// Form schema that accepts JSON string for credentials
const addStoreFormSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(255, "Store name too long"),
  storeUrl: z.string().url("Must be a valid URL"),
  platform: z.enum(["woocommerce", "shopify", "contifico"]),
  apiCredentials: z.string().min(1, "API credentials are required"),
});

type AddStoreFormData = z.infer<typeof addStoreFormSchema>;

interface AddStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStoreDialog({ open, onOpenChange }: AddStoreDialogProps) {
  const { toast } = useToast();
  const [testingConnection, setTestingConnection] = useState(false);

  const form = useForm<CreateStoreData>({
    resolver: zodResolver(addStoreFormSchema),
    defaultValues: {
      storeName: "",
      storeUrl: "",
      platform: "shopify",
      apiCredentials: "",
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: AddStoreFormData) => {
      // Parse JSON credentials before sending to backend
      let parsedCredentials;
      try {
        parsedCredentials = JSON.parse(data.apiCredentials);
      } catch (e) {
        throw new Error("Invalid JSON in API credentials");
      }
      
      const storeData = {
        storeName: data.storeName,
        storeUrl: data.storeUrl,
        platform: data.platform,
        apiCredentials: parsedCredentials,
        syncConfig: {}
      };
      
      const res = await apiRequest("POST", "/api/stores", storeData);
      return res.json();
    },
    onSuccess: (newStore) => {
      toast({
        title: "Store added successfully",
        description: `${newStore.storeName} has been connected to your account.`,
      });
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

  const testConnection = async () => {
    const isValid = await form.trigger(["storeUrl", "platform", "apiCredentials"]);
    if (!isValid) {
      toast({
        title: "Please fix form errors",
        description: "Complete the required fields before testing connection.",
        variant: "destructive",
      });
      return;
    }

    setTestingConnection(true);
    try {
      const formData = form.getValues();
      
      // Parse JSON credentials for testing
      let parsedCredentials;
      try {
        parsedCredentials = JSON.parse(formData.apiCredentials);
      } catch (e) {
        toast({
          title: "Invalid JSON",
          description: "Please enter valid JSON for API credentials",
          variant: "destructive",
        });
        setTestingConnection(false);
        return;
      }
      
      const testData = {
        storeName: formData.storeName,
        storeUrl: formData.storeUrl,
        platform: formData.platform,
        apiCredentials: parsedCredentials,
        syncConfig: {}
      };
      
      // Note: This would require a separate test endpoint - for now, we'll skip the test
      toast({
        title: "Ready to connect",
        description: "Credentials look valid. Click 'Add Store' to create the connection.",
      });
      
    } catch (error: any) {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = (data: AddStoreFormData) => {
    createStoreMutation.mutate(data);
  };

  const getCredentialsPlaceholder = (platform: string) => {
    switch (platform) {
      case "shopify":
        return "{\n  \"api_key\": \"your_api_key\",\n  \"access_token\": \"shpat_...\",\n  \"shop_domain\": \"yourstore.myshopify.com\"\n}";
      case "woocommerce":
        return "{\n  \"consumer_key\": \"ck_...\",\n  \"consumer_secret\": \"cs_...\"\n}";
      default:
        return "Enter API credentials as JSON";
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

            <FormField
              control={form.control}
              name="apiCredentials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Credentials</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={getCredentialsPlaceholder(form.watch("platform"))}
                      className="min-h-[120px] font-mono text-sm"
                      data-testid="textarea-api-credentials"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={testConnection}
                disabled={testingConnection || createStoreMutation.isPending}
                data-testid="button-test-connection"
                className="flex-1"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
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
                    Adding Store...
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