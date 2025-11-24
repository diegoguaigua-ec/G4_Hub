import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/pages/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface AdminAction {
  id: number;
  actionType: string;
  description: string;
  metadata: any;
  createdAt: string;
  adminUser?: {
    id: number;
    name: string;
    email: string;
  };
  targetTenant?: {
    id: number;
    name: string;
    subdomain: string;
  };
}

interface AuditLogsResponse {
  actions: AdminAction[];
  total: number;
  page: number;
  limit: number;
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedAction, setSelectedAction] = useState<AdminAction | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/admin/actions", { page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const res = await fetch(`/api/admin/actions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const getActionBadge = (actionType: string) => {
    const colors: Record<string, string> = {
      approve_account: "bg-green-500",
      reject_account: "bg-red-500",
      suspend_account: "bg-orange-500",
      activate_account: "bg-blue-500",
      change_plan: "bg-purple-500",
      delete_account: "bg-gray-800",
    };

    const labels: Record<string, string> = {
      approve_account: "Aprobar",
      reject_account: "Rechazar",
      suspend_account: "Suspender",
      activate_account: "Activar",
      change_plan: "Cambiar Plan",
      delete_account: "Eliminar",
    };

    return (
      <Badge className={colors[actionType] || "bg-gray-500"}>
        {labels[actionType] || actionType}
      </Badge>
    );
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs de Auditoría</h1>
          <p className="text-muted-foreground">
            Registro completo de todas las acciones administrativas
          </p>
        </div>

        {/* Audit Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Acciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Administrador</TableHead>
                        <TableHead>Tenant Afectado</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Detalles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.actions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay acciones registradas
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.actions.map((action) => (
                          <TableRow key={action.id}>
                            <TableCell className="font-mono text-sm">
                              {new Date(action.createdAt).toLocaleString("es-ES", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>{getActionBadge(action.actionType)}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {action.adminUser?.name || "N/A"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {action.adminUser?.email || ""}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {action.targetTenant?.name || "N/A"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {action.targetTenant?.subdomain
                                    ? `${action.targetTenant.subdomain}.g4hub.com`
                                    : ""}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {action.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedAction(action)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((page - 1) * limit) + 1} -{" "}
                      {Math.min(page * limit, data?.total || 0)} de {data?.total || 0}{" "}
                      acciones
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Details Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Acción</DialogTitle>
            <DialogDescription>
              Información completa de la acción administrativa
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    ID de Acción
                  </label>
                  <p className="font-mono text-sm">{selectedAction.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Tipo de Acción
                  </label>
                  <div className="mt-1">{getActionBadge(selectedAction.actionType)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Fecha y Hora
                  </label>
                  <p className="text-sm">
                    {new Date(selectedAction.createdAt).toLocaleString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Administrador
                  </label>
                  <p className="text-sm font-medium">
                    {selectedAction.adminUser?.name || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAction.adminUser?.email || ""}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Tenant Afectado
                </label>
                <p className="text-sm font-medium">
                  {selectedAction.targetTenant?.name || "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedAction.targetTenant?.subdomain
                    ? `${selectedAction.targetTenant.subdomain}.g4hub.com`
                    : ""}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Descripción
                </label>
                <p className="text-sm">{selectedAction.description}</p>
              </div>

              {selectedAction.metadata &&
                Object.keys(selectedAction.metadata).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Metadata Adicional
                    </label>
                    <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                      {JSON.stringify(selectedAction.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
