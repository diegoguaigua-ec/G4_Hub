import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/pages/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Shield,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatEcuadorDate } from "@/lib/dateFormatters";

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  planType: string;
  accountStatus: string;
  createdAt: string;
  expiresAt?: string | null;
  ownerEmail?: string;
  ownerName?: string;
}

interface UsersResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}

type ActionType = "approve" | "reject" | "suspend" | "activate" | "plan" | "delete" | "expiration" | "manage-users";

interface TenantUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface ActionDialog {
  open: boolean;
  type: ActionType | null;
  tenant: Tenant | null;
  reason?: string;
  planType?: string;
  expirationDate?: Date | null;
  tenantUsers?: TenantUser[];
  selectedUserId?: number;
  selectedUserRole?: string;
}

export default function AdminUsersPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse query params
  const params = new URLSearchParams(location.split("?")[1] || "");
  const [search, setSearch] = useState(params.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(params.get("filter") || "all");
  const [page, setPage] = useState(parseInt(params.get("page") || "1"));
  const limit = 10;

  // Update state when URL changes (e.g., from quick actions links)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split("?")[1] || "");
    const urlSearch = urlParams.get("search") || "";
    const urlFilter = urlParams.get("filter") || "all";
    const urlPage = parseInt(urlParams.get("page") || "1");

    setSearch(urlSearch);
    setStatusFilter(urlFilter);
    setPage(urlPage);
  }, [location]);

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<ActionDialog>({
    open: false,
    type: null,
    tenant: null,
    reason: "",
    planType: "starter",
    expirationDate: null,
  });

  // Fetch users
  const { data, isLoading, refetch } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", { search, status: statusFilter, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Action mutations
  const approveMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cuenta aprobada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ tenantId, reason }: { tenantId: number; reason: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cuenta rechazada" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ tenantId, reason }: { tenantId: number; reason: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/suspend`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cuenta suspendida" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cuenta activada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ tenantId, planType }: { tenantId: number; planType: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/plan`, { planType });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan actualizado exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${tenantId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cuenta eliminada permanentemente" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const expirationMutation = useMutation({
    mutationFn: async ({ tenantId, expiresAt }: { tenantId: number; expiresAt: Date | null }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/expires-at`, {
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Fecha de vencimiento actualizada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const changeUserRoleMutation = useMutation({
    mutationFn: async ({ tenantId, userId, role }: { tenantId: number; userId: number; role: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${tenantId}/role/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rol de usuario actualizado exitosamente" });
      // Refresh tenant users in the dialog
      if (actionDialog.tenant) {
        fetchTenantUsers(actionDialog.tenant.id);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fetchTenantUsers = async (tenantId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${tenantId}`);
      if (!res.ok) throw new Error("Failed to fetch tenant details");
      const data = await res.json();
      setActionDialog(prev => ({ ...prev, tenantUsers: data.users || [] }));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openDialog = async (type: ActionType, tenant: Tenant) => {
    const dialogState = {
      open: true,
      type,
      tenant,
      reason: "",
      planType: tenant.planType || "starter",
      expirationDate: tenant.expiresAt ? new Date(tenant.expiresAt) : null,
      tenantUsers: [],
      selectedUserId: undefined,
      selectedUserRole: undefined,
    };

    setActionDialog(dialogState);

    // Fetch tenant users if managing users
    if (type === "manage-users") {
      await fetchTenantUsers(tenant.id);
    }
  };

  const closeDialog = () => {
    setActionDialog({
      open: false,
      type: null,
      tenant: null,
      reason: "",
      planType: "starter",
      expirationDate: null,
      tenantUsers: [],
      selectedUserId: undefined,
      selectedUserRole: undefined,
    });
  };

  const handleAction = () => {
    if (!actionDialog.tenant) return;

    const tenantId = actionDialog.tenant.id;

    switch (actionDialog.type) {
      case "approve":
        approveMutation.mutate(tenantId);
        break;
      case "reject":
        if (!actionDialog.reason?.trim()) {
          toast({ title: "Error", description: "Debe proporcionar una razón", variant: "destructive" });
          return;
        }
        rejectMutation.mutate({ tenantId, reason: actionDialog.reason });
        break;
      case "suspend":
        if (!actionDialog.reason?.trim()) {
          toast({ title: "Error", description: "Debe proporcionar una razón", variant: "destructive" });
          return;
        }
        suspendMutation.mutate({ tenantId, reason: actionDialog.reason });
        break;
      case "activate":
        activateMutation.mutate(tenantId);
        break;
      case "plan":
        if (actionDialog.planType) {
          changePlanMutation.mutate({ tenantId, planType: actionDialog.planType });
        }
        break;
      case "delete":
        deleteMutation.mutate(tenantId);
        break;
      case "expiration":
        expirationMutation.mutate({ tenantId, expiresAt: actionDialog.expirationDate || null });
        break;
      case "manage-users":
        if (!actionDialog.selectedUserId || !actionDialog.selectedUserRole) {
          toast({ title: "Error", description: "Debe seleccionar un usuario y un rol", variant: "destructive" });
          return;
        }
        changeUserRoleMutation.mutate({
          tenantId,
          userId: actionDialog.selectedUserId,
          role: actionDialog.selectedUserRole
        });
        break;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Aprobado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rechazado</Badge>;
      case "suspended":
        return <Badge className="bg-gray-500">Suspendido</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors = {
      starter: "bg-blue-500",
      professional: "bg-purple-500",
      enterprise: "bg-orange-500",
    };
    return <Badge className={colors[plan as keyof typeof colors] || "bg-gray-500"}>{plan}</Badge>;
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  const isActionLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    suspendMutation.isPending ||
    activateMutation.isPending ||
    changePlanMutation.isPending ||
    deleteMutation.isPending ||
    expirationMutation.isPending ||
    changeUserRoleMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administra cuentas, aprobaciones y planes de usuarios
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, email o subdominio..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                  <SelectItem value="suspended">Suspendidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
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
                        <TableHead>Empresa</TableHead>
                        <TableHead>Subdominio</TableHead>
                        <TableHead>Propietario</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Fecha Creación</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.tenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No se encontraron usuarios
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.tenants.map((tenant) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">{tenant.name}</TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {tenant.subdomain}.g4hub.com
                              </code>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{tenant.ownerName || "N/A"}</div>
                                <div className="text-sm text-muted-foreground">
                                  {tenant.ownerEmail || ""}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{getPlanBadge(tenant.planType)}</TableCell>
                            <TableCell>{getStatusBadge(tenant.accountStatus)}</TableCell>
                            <TableCell>
                              {tenant.expiresAt ? (
                                <div>
                                  <div className={
                                    new Date(tenant.expiresAt) < new Date()
                                      ? "text-red-500 font-medium"
                                      : new Date(tenant.expiresAt) < new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
                                      ? "text-yellow-500 font-medium"
                                      : "text-foreground"
                                  }>
                                    {formatEcuadorDate(tenant.expiresAt)}
                                  </div>
                                  {new Date(tenant.expiresAt) < new Date() && (
                                    <div className="text-xs text-red-500">Expirada</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Sin vencimiento</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatEcuadorDate(tenant.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuSeparator />

                                  {tenant.accountStatus === "pending" && (
                                    <>
                                      <DropdownMenuItem onClick={() => openDialog("approve", tenant)}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                        Aprobar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openDialog("reject", tenant)}>
                                        <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                        Rechazar
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {tenant.accountStatus === "approved" && (
                                    <DropdownMenuItem onClick={() => openDialog("suspend", tenant)}>
                                      <Pause className="mr-2 h-4 w-4 text-orange-600" />
                                      Suspender
                                    </DropdownMenuItem>
                                  )}

                                  {tenant.accountStatus === "suspended" && (
                                    <DropdownMenuItem onClick={() => openDialog("activate", tenant)}>
                                      <Play className="mr-2 h-4 w-4 text-green-600" />
                                      Reactivar
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem onClick={() => openDialog("plan", tenant)}>
                                    <CreditCard className="mr-2 h-4 w-4 text-blue-600" />
                                    Cambiar Plan
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => openDialog("expiration", tenant)}>
                                    <CalendarIcon className="mr-2 h-4 w-4 text-purple-600" />
                                    Establecer Vencimiento
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => openDialog("manage-users", tenant)}>
                                    <Users className="mr-2 h-4 w-4 text-indigo-600" />
                                    Gestionar Usuarios
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openDialog("delete", tenant)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                      Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, data?.total || 0)} de {data?.total || 0} usuarios
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

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "approve" && "Aprobar Cuenta"}
              {actionDialog.type === "reject" && "Rechazar Cuenta"}
              {actionDialog.type === "suspend" && "Suspender Cuenta"}
              {actionDialog.type === "activate" && "Reactivar Cuenta"}
              {actionDialog.type === "plan" && "Cambiar Plan"}
              {actionDialog.type === "expiration" && "Establecer Fecha de Vencimiento"}
              {actionDialog.type === "manage-users" && "Gestionar Usuarios"}
              {actionDialog.type === "delete" && "Eliminar Cuenta"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === "approve" &&
                `¿Estás seguro que deseas aprobar la cuenta de ${actionDialog.tenant?.name}?`}
              {actionDialog.type === "reject" &&
                `¿Estás seguro que deseas rechazar la cuenta de ${actionDialog.tenant?.name}?`}
              {actionDialog.type === "suspend" &&
                `¿Estás seguro que deseas suspender la cuenta de ${actionDialog.tenant?.name}?`}
              {actionDialog.type === "activate" &&
                `¿Estás seguro que deseas reactivar la cuenta de ${actionDialog.tenant?.name}?`}
              {actionDialog.type === "plan" &&
                `Selecciona el nuevo plan para ${actionDialog.tenant?.name}`}
              {actionDialog.type === "expiration" &&
                `Establece la fecha de vencimiento para la cuenta de ${actionDialog.tenant?.name}. Deja vacío para eliminar el vencimiento.`}
              {actionDialog.type === "manage-users" &&
                `Selecciona un usuario y cambia su rol entre 'user' y 'admin'`}
              {actionDialog.type === "delete" &&
                `ADVERTENCIA: Esta acción es irreversible. Se eliminará permanentemente la cuenta de ${actionDialog.tenant?.name} y todos sus datos.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(actionDialog.type === "reject" || actionDialog.type === "suspend") && (
              <div className="space-y-2">
                <Label htmlFor="reason">Razón {actionDialog.type === "reject" ? "de rechazo" : "de suspensión"}</Label>
                <Textarea
                  id="reason"
                  placeholder="Explica el motivo..."
                  value={actionDialog.reason}
                  onChange={(e) =>
                    setActionDialog({ ...actionDialog, reason: e.target.value })
                  }
                  rows={4}
                />
              </div>
            )}

            {actionDialog.type === "plan" && (
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={actionDialog.planType}
                  onValueChange={(value) =>
                    setActionDialog({ ...actionDialog, planType: value })
                  }
                >
                  <SelectTrigger id="plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {actionDialog.type === "expiration" && (
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {actionDialog.expirationDate ? (
                        format(actionDialog.expirationDate, "PPP", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={actionDialog.expirationDate || undefined}
                      onSelect={(date) =>
                        setActionDialog({ ...actionDialog, expirationDate: date || null })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActionDialog({ ...actionDialog, expirationDate: null })}
                  >
                    Eliminar Vencimiento
                  </Button>
                  {actionDialog.tenant?.expiresAt && (
                    <div className="text-sm text-muted-foreground flex items-center">
                      Actual: {format(new Date(actionDialog.tenant.expiresAt), "PPP", { locale: es })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {actionDialog.type === "manage-users" && (
              <div className="space-y-4">
                {actionDialog.tenantUsers && actionDialog.tenantUsers.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="user-select">Seleccionar Usuario</Label>
                      <Select
                        value={actionDialog.selectedUserId?.toString()}
                        onValueChange={(value) => {
                          const userId = parseInt(value);
                          const user = actionDialog.tenantUsers?.find(u => u.id === userId);
                          setActionDialog({
                            ...actionDialog,
                            selectedUserId: userId,
                            selectedUserRole: user?.role || "user"
                          });
                        }}
                      >
                        <SelectTrigger id="user-select">
                          <SelectValue placeholder="Selecciona un usuario" />
                        </SelectTrigger>
                        <SelectContent>
                          {actionDialog.tenantUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{user.name || user.email}</span>
                                <Badge variant="outline" className="text-xs">
                                  {user.role === "admin" ? (
                                    <><Shield className="h-3 w-3 mr-1 inline" /> Admin</>
                                  ) : (
                                    "User"
                                  )}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {actionDialog.selectedUserId && (
                      <div className="space-y-2">
                        <Label htmlFor="role-select">Nuevo Rol</Label>
                        <Select
                          value={actionDialog.selectedUserRole}
                          onValueChange={(value) =>
                            setActionDialog({ ...actionDialog, selectedUserRole: value })
                          }
                        >
                          <SelectTrigger id="role-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                User <span className="text-xs text-muted-foreground">(Acceso básico)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Admin <span className="text-xs text-muted-foreground">(Acceso total)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Cargando usuarios...
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isActionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={isActionLoading}
              variant={actionDialog.type === "delete" ? "destructive" : "default"}
            >
              {isActionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
