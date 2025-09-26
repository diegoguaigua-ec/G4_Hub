import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Settings, ExternalLink, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Store } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddStoreDialog } from "./add-store-dialog";

export default function StoresSection() {
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: stores = [], isLoading, error } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const res = await apiRequest("POST", `/api/stores/${storeId}/test-connection`);
      return res.json();
    },
    onSuccess: (result, storeId) => {
      toast({
        title: result.success ? "Connection successful" : "Connection failed",
        description: result.success ? `Connected to ${result.store_name}` : result.error,
        variant: result.success ? "default" : "destructive",
      });
      // Refresh stores list to update connection status
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusDisplay = (store: Store) => {
    const status = store.connectionStatus || "unknown";
    switch (status) {
      case "connected":
        return { text: "Connected", color: "text-green-600", bg: "bg-green-100" };
      case "error":
        return { text: "Error", color: "text-red-600", bg: "bg-red-100" };
      default:
        return { text: "Unknown", color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  const getPlatformDisplay = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "shopify":
        return { letter: "S", bg: "bg-blue-100", text: "text-blue-600" };
      case "woocommerce":
        return { letter: "W", bg: "bg-purple-100", text: "text-purple-600" };
      default:
        return { letter: "?", bg: "bg-gray-100", text: "text-gray-600" };
    }
  };

  const formatLastSync = (lastSyncAt?: string | Date | null) => {
    if (!lastSyncAt) return "Never";
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Failed to load stores</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Connected Stores</h2>
          <p className="text-muted-foreground">Manage your connected e-commerce platforms</p>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground" 
          data-testid="button-add-store"
          onClick={() => setAddStoreOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No stores connected</h3>
            <p className="text-muted-foreground mb-6">
              Connect your first e-commerce store to start automating your operations
            </p>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setAddStoreOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Store
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stores.map((store) => {
            const statusDisplay = getStatusDisplay(store);
            const platformDisplay = getPlatformDisplay(store.platform);
            
            return (
              <Card key={store.id} className="border border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${platformDisplay.bg} ${platformDisplay.text}`}>
                        <span className="text-lg font-bold">
                          {platformDisplay.letter}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{store.storeName}</h3>
                          <ExternalLink 
                            className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary" 
                            onClick={() => window.open(store.storeUrl, '_blank')}
                          />
                        </div>
                        <p className="text-muted-foreground text-sm capitalize">{store.platform}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 ${statusDisplay.bg} ${statusDisplay.color} rounded-full text-xs`}>
                      <div className={`w-2 h-2 ${statusDisplay.color === 'text-green-600' ? 'bg-green-500' : statusDisplay.color === 'text-red-600' ? 'bg-red-500' : 'bg-gray-500'} rounded-full`}></div>
                      {statusDisplay.text}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Products</p>
                      <p className="font-semibold text-foreground">{store.productsCount || '–'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="font-semibold text-foreground">{formatLastSync(store.lastSyncAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className={`font-semibold ${statusDisplay.color}`}>{statusDisplay.text}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-primary/10 text-primary hover:bg-primary/20" 
                      variant="secondary"
                      data-testid={`button-sync-${store.id}`}
                      disabled={testConnectionMutation.isPending}
                      onClick={() => testConnectionMutation.mutate(store.id)}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                      Test Connection
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      data-testid={`button-settings-${store.id}`}
                      disabled
                      title="Coming soon"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      <AddStoreDialog 
        open={addStoreOpen} 
        onOpenChange={setAddStoreOpen}
      />
    </div>
  );
}
