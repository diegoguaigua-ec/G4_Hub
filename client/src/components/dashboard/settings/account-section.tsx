import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  planType: string;
  status: string;
}

export default function AccountSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userName, setUserName] = useState(user?.name || "");
  const [userEmail, setUserEmail] = useState(user?.email || "");
  const [tenantName, setTenantName] = useState("");

  // Fetch tenant data
  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/current"],
  });

  // Update tenant name when data is loaded
  useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name);
    }
  }, [tenant]);

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await apiRequest("PUT", `/api/user/${user?.id}`, data);
      const result = await res.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Usuario actualizado",
        description: "Tu información personal ha sido actualizada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update tenant mutation
  const updateTenantMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("PUT", `/api/tenant/${tenant?.id}`, data);
      const result = await res.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Empresa actualizada",
        description: "La información de tu empresa ha sido actualizada",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/current"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/user/${user?.id}`);
      const result = await res.json();
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Cuenta eliminada",
        description: "Tu cuenta ha sido eliminada permanentemente",
      });
      // Logout and redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveUser = () => {
    if (!userName.trim() || !userEmail.trim()) {
      toast({
        title: "Campos requeridos",
        description: "El nombre y email son obligatorios",
        variant: "destructive",
      });
      return;
    }
    updateUserMutation.mutate({ name: userName, email: userEmail });
  };

  const handleSaveTenant = () => {
    if (!tenantName.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre de la empresa es obligatorio",
        variant: "destructive",
      });
      return;
    }
    updateTenantMutation.mutate({ name: tenantName });
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>
            Actualiza tu nombre y correo electrónico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input
              id="name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="juan@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Input
              id="role"
              value={user?.role || "user"}
              disabled
              className="bg-muted"
            />
          </div>

          <Button
            onClick={handleSaveUser}
            disabled={updateUserMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateUserMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Empresa</CardTitle>
          <CardDescription>
            Gestiona la información de tu organización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Nombre de la Empresa</Label>
            <Input
              id="company"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Mi Empresa S.A."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdominio</Label>
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                value={tenant?.subdomain || ""}
                disabled
                className="bg-muted"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                .g4hub.com
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              El subdominio no puede ser modificado
            </p>
          </div>

          <Button
            onClick={handleSaveTenant}
            disabled={updateTenantMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateTenantMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card>
        <CardHeader>
          <CardTitle>Eliminar Cuenta</CardTitle>
          <CardDescription>
            Elimina permanentemente tu cuenta y todos tus datos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-black text-white hover:bg-black/90 hover:text-white border-black"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Cuenta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente tu
                  cuenta y todos los datos asociados de nuestros servidores.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteAccountMutation.isPending}
                >
                  {deleteAccountMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    "Sí, eliminar mi cuenta"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
