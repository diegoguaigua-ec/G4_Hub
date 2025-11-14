import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Package,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MinusCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface InventoryTabProps {
  storeId: number;
}

interface ProductSyncStatus {
  sku: string;
  name: string;
  stockStore: number;
  stockContifico: number | null;
  status: "pending" | "synced" | "different" | "not_in_contifico" | "error";
  lastSync: string | null;
  platformProductId: string;
}

interface SyncStatusResponse {
  products: ProductSyncStatus[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
  lastSyncAt: string | null;
}

export function InventoryTab({ storeId }: InventoryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Reset selections when page changes
  useEffect(() => {
    setSelectedProducts(new Set());
  }, [pagination.page]);

  // Fetch store integrations to get Contífico integration ID
  const { data: integrationsData } = useQuery({
    queryKey: [`/api/stores/${storeId}/integrations`],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/integrations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar integraciones");
      return res.json();
    },
  });

  // Find Contífico integration
  const contificoIntegration = integrationsData?.find(
    (integration: any) =>
      integration.integration?.name?.toLowerCase().includes("contífico") ||
      integration.integration?.name?.toLowerCase().includes("contifico")
  );

  // Fetch product sync status
  const { data, isLoading, refetch } = useQuery<SyncStatusResponse>({
    queryKey: [
      `/api/stores/${storeId}/products/sync-status`,
      filters.status,
      filters.search,
      pagination.page,
      pagination.limit,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.search) params.append("search", filters.search);
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      const res = await fetch(`/api/stores/${storeId}/products/sync-status?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar estado de sincronización");
      return res.json();
    },
  });

  // Sync mutation - triggers full pull from Contífico (all products)
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!contificoIntegration) {
        throw new Error("No se encontró integración de Contífico para esta tienda");
      }

      const res = await fetch(
        `/api/sync/pull/${storeId}/${contificoIntegration.integrationId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dryRun: false,
            limit: 1000,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al sincronizar");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${storeId}/products/sync-status`],
      });
      toast({
        title: "Sincronización completada",
        description: `${data.result.success} productos actualizados, ${data.result.skipped} omitidos, ${data.result.failed} fallidos`,
      });
      setSelectedProducts(new Set());
      refetch(); // Refresh the product list
    },
    onError: (error: Error) => {
      toast({
        title: "Error al sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Selective sync mutation - only syncs selected products by SKU
  const syncSelectiveMutation = useMutation({
    mutationFn: async (skus: string[]) => {
      if (!contificoIntegration) {
        throw new Error("No se encontró integración de Contífico para esta tienda");
      }

      const res = await fetch(
        `/api/sync/pull-selective/${storeId}/${contificoIntegration.integrationId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            skus,
            dryRun: false,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al sincronizar productos seleccionados");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/stores/${storeId}/products/sync-status`],
      });
      toast({
        title: "Sincronización selectiva completada",
        description: `${data.result.success} productos actualizados, ${data.result.skipped} omitidos, ${data.result.failed} fallidos`,
      });
      setSelectedProducts(new Set());
      refetch(); // Refresh the product list
    },
    onError: (error: Error) => {
      toast({
        title: "Error al sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.products) {
      setSelectedProducts(new Set(data.products.map((p) => p.sku)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (sku: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(sku);
    } else {
      newSelected.delete(sku);
    }
    setSelectedProducts(newSelected);
  };

  const handleSyncSelected = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "Sin selección",
        description: "Por favor selecciona al menos un producto para sincronizar",
        variant: "destructive",
      });
      return;
    }

    // Use selective sync mutation with selected SKUs
    const selectedSkus = Array.from(selectedProducts);
    syncSelectiveMutation.mutate(selectedSkus);
  };

  const handleSyncAll = () => {
    if (!contificoIntegration) {
      toast({
        title: "Sin integración",
        description: "No se encontró integración de Contífico para esta tienda",
        variant: "destructive",
      });
      return;
    }

    syncMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "synced":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "different":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "not_in_contifico":
        return <MinusCircle className="h-4 w-4 text-purple-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "synced":
        return "Sincronizado";
      case "different":
        return "Diferente";
      case "not_in_contifico":
        return "No en Contífico";
      case "error":
        return "Error";
      case "pending":
        return "Pendiente";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "bg-green-100 text-green-700";
      case "different":
        return "bg-amber-100 text-amber-700";
      case "not_in_contifico":
        return "bg-purple-100 text-purple-700";
      case "error":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Inventario de Productos
          </h2>
          <p className="text-muted-foreground">
            Estado de sincronización de productos entre tu tienda y Contífico
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button
            onClick={handleSyncAll}
            disabled={syncMutation.isPending || !contificoIntegration}
            size="sm"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar Todo
          </Button>
        </div>
      </div>

      {data?.lastSyncAt && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Última sincronización: {formatDate(data.lastSyncAt)}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Estado
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters({ ...filters, status: value === "all" ? undefined : value });
                  setPagination({ ...pagination, page: 1 });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="synced">Sincronizado</SelectItem>
                  <SelectItem value="different">Diferente</SelectItem>
                  <SelectItem value="not_in_contifico">No en Contífico</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU o nombre..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {data?.pagination.total || 0} productos encontrados
            </p>
            {selectedProducts.size > 0 && (
              <Button
                onClick={handleSyncSelected}
                disabled={syncSelectiveMutation.isPending}
                size="sm"
                variant="default"
              >
                {syncSelectiveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Seleccionados ({selectedProducts.size})
              </Button>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data || data.products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron productos</p>
              <p className="text-sm mt-2">Intenta ajustar los filtros o asegúrate de tener productos con SKU</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <Checkbox
                        checked={
                          data.products.length > 0 &&
                          data.products.every((p) => selectedProducts.has(p.sku))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Stock Tienda
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Stock Contífico
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Última Actualización
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => (
                    <tr
                      key={product.sku}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selectedProducts.has(product.sku)}
                          onCheckedChange={(checked) =>
                            handleSelectProduct(product.sku, checked as boolean)
                          }
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {product.sku}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {product.name}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-foreground">
                        {product.stockStore}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-foreground">
                        {product.stockContifico ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(product.status)}
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(product.status)}`}
                          >
                            {getStatusLabel(product.status)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDate(product.lastSync)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.products.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Página {data.pagination.page} de {data.pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={!data.pagination.hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
