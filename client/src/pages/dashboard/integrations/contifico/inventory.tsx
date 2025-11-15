import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "../../../dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { InventoryTab } from "@/components/inventory/inventory-tab";
import { SyncTab } from "@/components/inventory/sync-tab";
import { ConfigTab } from "@/components/inventory/config-tab";
import { MovementsTab } from "@/components/inventory/push/movements-tab";

interface Store {
  id: number;
  storeName: string;
  platform: string;
  connectionStatus: string;
}

export default function ContificoInventoryPage() {
  const [location, setLocation] = useLocation();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");

  // Leer storeId de la URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const storeIdParam = searchParams.get("storeId");
    if (storeIdParam) {
      setSelectedStoreId(storeIdParam);
    }
  }, [location]);

  // Fetch stores
  const { data: stores = [], isLoading: storesLoading } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    queryFn: async () => {
      const res = await fetch("/api/stores", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar tiendas");
      return res.json();
    },
  });

  // Actualizar URL cuando cambia la tienda seleccionada
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    const params = new URLSearchParams(window.location.search);
    params.set("storeId", storeId);
    setLocation(`${location.split("?")[0]}?${params.toString()}`);
  };

  const selectedStore = stores.find((s) => s.id.toString() === selectedStoreId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/dashboard/integrations/contifico")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Módulos de Contífico
        </Button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Inventario - Contífico
              </h1>
              <p className="text-muted-foreground">
                Sincroniza productos y stock en tiempo real
              </p>
            </div>
          </div>
        </div>

        {/* Store Selector - Always visible */}
        <div className="bg-background border rounded-lg p-4 sticky top-0 z-10 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tienda
            </label>
            <Select
              value={selectedStoreId || ""}
              onValueChange={handleStoreChange}
              disabled={storesLoading}
            >
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Selecciona una tienda" />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 && !storesLoading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No tienes tiendas conectadas
                  </div>
                ) : (
                  stores.map((store) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{store.storeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({store.platform})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {!selectedStoreId ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Selecciona una tienda
            </h3>
            <p className="text-muted-foreground max-w-md">
              Para comenzar a gestionar el inventario, selecciona una de tus
              tiendas conectadas en el selector de arriba.
            </p>
          </div>
        ) : (
          // Tabs Content
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-[700px]">
              <TabsTrigger value="inventory">Inventario</TabsTrigger>
              <TabsTrigger value="syncs">Sincronizaciones</TabsTrigger>
              <TabsTrigger value="movements">Movimientos</TabsTrigger>
              <TabsTrigger value="config">Configuración</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              <InventoryTab storeId={parseInt(selectedStoreId)} />
            </TabsContent>

            <TabsContent value="syncs" className="space-y-4">
              <SyncTab storeId={parseInt(selectedStoreId)} />
            </TabsContent>

            <TabsContent value="movements" className="space-y-4">
              <MovementsTab
                storeId={parseInt(selectedStoreId)}
                storeName={selectedStore?.storeName || ''}
              />
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <ConfigTab storeId={parseInt(selectedStoreId)} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
