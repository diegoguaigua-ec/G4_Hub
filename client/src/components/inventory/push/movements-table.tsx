import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, RotateCw, Package, CheckCircle, Clock, Zap, XCircle } from "lucide-react";
import { useMovements, type Movement, type MovementsFilters } from "@/hooks/use-movements";
import { formatTableDate, formatRelativeDate } from "@/lib/dateFormatters";
import { cn } from "@/lib/utils";

interface MovementsTableProps {
  storeId: number | null;
  filters: MovementsFilters;
  onFiltersChange: (filters: MovementsFilters) => void;
  onViewDetails: (movement: Movement) => void;
  onRetry: (movementId: number) => void;
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle,
        label: 'Completado',
        variant: 'default' as const,
        className: 'bg-green-500/10 text-green-700 border-green-200',
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pendiente',
        variant: 'secondary' as const,
        className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
      };
    case 'processing':
      return {
        icon: Zap,
        label: 'Procesando',
        variant: 'default' as const,
        className: 'bg-blue-500/10 text-blue-700 border-blue-200 animate-pulse',
      };
    case 'failed':
      return {
        icon: XCircle,
        label: 'Fallido',
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-700 border-red-200',
      };
    default:
      return {
        icon: Clock,
        label: status,
        variant: 'secondary' as const,
        className: '',
      };
  }
}

export function MovementsTable({
  storeId,
  filters,
  onFiltersChange,
  onViewDetails,
  onRetry,
}: MovementsTableProps) {
  const { data, isLoading } = useMovements(storeId, filters);

  const handlePreviousPage = () => {
    if (filters.page > 1) {
      onFiltersChange({ ...filters, page: filters.page - 1 });
    }
  };

  const handleNextPage = () => {
    if (data && filters.page < data.pagination.total_pages) {
      onFiltersChange({ ...filters, page: filters.page + 1 });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Orden ID</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Intentos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!data || data.movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No hay movimientos</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Los movimientos de inventario aparecerán aquí cuando se procesen pedidos
          desde tus tiendas conectadas.
        </p>
      </div>
    );
  }

  const { movements, pagination } = data;
  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Orden ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Intentos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const statusInfo = getStatusInfo(movement.status);
              const StatusIcon = statusInfo.icon;

              // Extract shopifyOrderName from metadata
              const shopifyOrderName = movement.metadata?.originalEvent?.shopifyOrderName ||
                                       movement.metadata?.originalEvent?.wooOrderNumber;

              return (
                <TableRow key={movement.id}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm">
                            {formatTableDate(movement.createdAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatRelativeDate(movement.createdAt)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {shopifyOrderName ? (
                      <span>{shopifyOrderName}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    #{movement.orderId || movement.id}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={movement.movementType === 'egreso' ? 'destructive' : 'default'}
                      className={
                        movement.movementType === 'egreso'
                          ? 'bg-red-500/10 text-red-700 border-red-200'
                          : 'bg-green-500/10 text-green-700 border-green-200'
                      }
                    >
                      {movement.movementType === 'egreso' ? 'Egreso' : 'Ingreso'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{movement.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant} className={statusInfo.className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span
                      className={cn(
                        "text-sm",
                        movement.attempts > 0 ? "text-yellow-600 font-medium" : "text-muted-foreground"
                      )}
                    >
                      {movement.attempts}/{movement.maxAttempts}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(movement)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      {movement.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRetry(movement.id)}
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          Reintentar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {movements.map((movement) => {
          const statusInfo = getStatusInfo(movement.status);
          const StatusIcon = statusInfo.icon;

          // Extract shopifyOrderName from metadata
          const shopifyOrderName = movement.metadata?.originalEvent?.shopifyOrderName ||
                                   movement.metadata?.originalEvent?.wooOrderNumber;

          return (
            <div key={movement.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  {shopifyOrderName && (
                    <p className="text-sm font-semibold text-foreground">{shopifyOrderName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ID: #{movement.orderId || movement.id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTableDate(movement.createdAt)}
                  </p>
                </div>
                <Badge variant={statusInfo.variant} className={statusInfo.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge
                    variant={movement.movementType === 'egreso' ? 'destructive' : 'default'}
                    className={cn(
                      "ml-2",
                      movement.movementType === 'egreso'
                        ? 'bg-red-500/10 text-red-700'
                        : 'bg-green-500/10 text-green-700'
                    )}
                  >
                    {movement.movementType === 'egreso' ? 'Egreso' : 'Ingreso'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Items:</span>
                  <span className="ml-2 font-medium">{movement.quantity}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onViewDetails(movement)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                {movement.status === 'failed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onRetry(movement.id)}
                  >
                    <RotateCw className="h-4 w-4 mr-1" />
                    Reintentar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {startIndex} a {endIndex} de {pagination.total} movimientos
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={pagination.page >= pagination.total_pages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
