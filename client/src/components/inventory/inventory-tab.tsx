import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface InventoryTabProps {
  storeId: number;
}

export function InventoryTab({ storeId }: InventoryTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Inventario de Productos
          </h2>
          <p className="text-muted-foreground">
            Estado de sincronización de productos entre tu tienda y Contífico
          </p>
        </div>
        <Button disabled variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar Ahora
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Esta funcionalidad estará disponible próximamente. Actualmente, puedes usar
          el tab de Sincronizaciones para ver el historial y el tab de Configuración
          para gestionar la sincronización automática.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Módulo en Desarrollo
            </h3>
            <p className="text-muted-foreground max-w-md">
              La tabla de comparación de inventario y el estado de sincronización
              por producto se implementará próximamente.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Tienda ID: {storeId}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
