import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, Zap, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatEcuadorDateTime } from "@/lib/dateFormatters";
import type { Movement } from "@/hooks/use-movements";

interface MovementDetailModalProps {
  storeId: number | null;
  movementId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementDetailModal({ storeId, movementId, open, onOpenChange }: MovementDetailModalProps) {

  const { data, isLoading } = useQuery<{ movement: Movement }>({
    queryKey: ['movement-detail', storeId, movementId],
    queryFn: async () => {
      if (!storeId || !movementId) throw new Error('Missing params');
      const response = await fetch(`/api/stores/${storeId}/inventory-push/movements/${movementId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch movement');
      return response.json();
    },
    enabled: !!storeId && !!movementId && open,
  });

  const movement = data?.movement;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Completado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-700"><Zap className="h-3 w-3 mr-1" />Procesando</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-700"><XCircle className="h-3 w-3 mr-1" />Fallido</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalles del Movimiento - Orden #{movement?.orderId || movement?.id}
            </DialogTitle>
            <DialogDescription>
              Información completa del movimiento de inventario
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : movement ? (
            <div className="space-y-6">
              {/* Pedido destacado si existe */}
              {(movement.metadata?.originalEvent?.shopifyOrderName || movement.metadata?.originalEvent?.wooOrderNumber) && (
                <div className="rounded-lg bg-muted/50 border-2 border-border p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Pedido:</span>
                    <span className="text-xl font-bold text-foreground">
                      {movement.metadata.originalEvent.shopifyOrderName || movement.metadata.originalEvent.wooOrderNumber}
                    </span>
                  </div>
                  {movement.metadata.originalEvent.customerEmail && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Cliente: {movement.metadata.originalEvent.customerEmail}
                    </p>
                  )}
                </div>
              )}

              {/* Información General */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Información General</h3>
                <div className="grid grid-cols-2 gap-4 text-sm rounded-md border p-4">
                  <div><span className="text-muted-foreground">Tipo:</span> <Badge variant={movement.movementType === 'egreso' ? 'destructive' : 'default'}>{movement.movementType === 'egreso' ? 'Egreso' : 'Ingreso'}</Badge></div>
                  <div><span className="text-muted-foreground">Orden ID:</span> <span className="font-medium">#{movement.orderId || movement.id}</span></div>
                  <div><span className="text-muted-foreground">Evento:</span> {movement.eventType}</div>
                  <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{movement.sku}</span></div>
                  <div><span className="text-muted-foreground">Cantidad:</span> {movement.quantity}</div>
                  <div><span className="text-muted-foreground">Estado:</span> {getStatusBadge(movement.status)}</div>
                  <div><span className="text-muted-foreground">Creado:</span> {formatEcuadorDateTime(movement.createdAt)}</div>
                  {movement.processedAt && (
                    <div><span className="text-muted-foreground">Procesado:</span> {formatEcuadorDateTime(movement.processedAt)}</div>
                  )}
                </div>
              </div>

              {/* Historial de Intentos */}
              {movement.attempts > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Historial de Intentos</h3>
                  <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">Intentos: {movement.attempts}/{movement.maxAttempts}</p>
                    {movement.lastAttemptAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Último intento: {formatEcuadorDateTime(movement.lastAttemptAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {movement.status === 'failed' && movement.errorMessage && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Error</h3>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{movement.errorMessage}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Metadata */}
              {movement.metadata && Object.keys(movement.metadata).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Información Adicional</h3>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                    {JSON.stringify(movement.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
