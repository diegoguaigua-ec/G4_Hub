import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "@shared/schema";

export default function StoresSection() {
  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
  });

  const mockStores = [
    {
      id: 1,
      storeName: "Mi Tienda Online",
      platform: "Shopify",
      products: 347,
      lastSync: "2m ago",
      status: "Healthy",
      platformColor: "bg-blue-100 text-blue-600",
      statusColor: "text-green-600",
    },
    {
      id: 2,
      storeName: "Boutique Fashion",
      platform: "WooCommerce",
      products: 892,
      lastSync: "5m ago",
      status: "Healthy",
      platformColor: "bg-purple-100 text-purple-600",
      statusColor: "text-green-600",
    },
  ];

  const displayStores = stores && stores.length > 0 ? stores : mockStores;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
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
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-add-store">
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </div>

      {displayStores.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No stores connected</h3>
            <p className="text-muted-foreground mb-6">
              Connect your first e-commerce store to start automating your operations
            </p>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Connect Store
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayStores.map((store: any) => (
            <Card key={store.id} className="border border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${store.platformColor}`}>
                      <span className="text-lg font-bold">
                        {store.platform === "Shopify" ? "S" : "W"}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{store.storeName}</h3>
                      <p className="text-muted-foreground text-sm">{store.platform}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Products</p>
                    <p className="font-semibold text-foreground">{store.products}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Sync</p>
                    <p className="font-semibold text-foreground">{store.lastSync}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className={`font-semibold ${store.statusColor}`}>{store.status}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-primary/10 text-primary hover:bg-primary/20" 
                    variant="secondary"
                    data-testid={`button-sync-${store.id}`}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    data-testid={`button-settings-${store.id}`}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
