import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Mail, CheckCircle } from "lucide-react";

export default function PendingApprovalPage() {
  const { user, isLoading, logoutMutation } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user, redirect to auth
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // If user has approved account, redirect to dashboard
  // This check will be done by the guard, but we add it here as fallback
  if (user.tenant?.accountStatus === "approved") {
    return <Redirect to="/dashboard" />;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen login-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card className="shadow-2xl border-0">
          <CardContent className="p-12">
            <div className="text-center space-y-6">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Clock className="h-10 w-10 text-yellow-500" />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                  Cuenta Pendiente de Aprobación
                </h1>
                <p className="text-lg text-muted-foreground">
                  Tu cuenta está siendo revisada por nuestro equipo
                </p>
              </div>

              {/* Info Cards */}
              <div className="grid gap-4 text-left pt-6">
                <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                  <Mail className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Recibirás una notificación</h3>
                    <p className="text-sm text-muted-foreground">
                      Te enviaremos un correo electrónico a <strong>{user.email}</strong> cuando tu cuenta sea aprobada.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">¿Qué sigue?</h3>
                    <p className="text-sm text-muted-foreground">
                      Nuestro equipo revisará tu solicitud en las próximas 24-48 horas. Una vez aprobada,
                      podrás acceder a todas las funcionalidades de G4 Hub.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="pt-6 border-t">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Empresa:</strong> {user.tenant?.name}</p>
                  <p><strong>Subdominio:</strong> {user.tenant?.subdomain}.g4hub.com</p>
                  <p><strong>Plan:</strong> {user.tenant?.planType || 'starter'}</p>
                  <p><strong>Estado:</strong> <span className="text-yellow-600 font-medium">Pendiente</span></p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-6">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cerrando sesión...
                    </>
                  ) : (
                    "Cerrar Sesión"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Si tienes alguna pregunta, contáctanos a soporte@g4hub.com
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
