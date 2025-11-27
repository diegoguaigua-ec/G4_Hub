import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Mail } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ExpirationBanner() {
  const { user } = useAuth();
  const [showReactivationDialog, setShowReactivationDialog] = useState(false);

  if (!user?.tenant?.expiresAt) {
    return null;
  }

  const expiresAt = new Date(user.tenant.expiresAt);
  const now = new Date();
  const isExpired = expiresAt < now;
  const daysUntilExpiration = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Show warning if expiring within 10 days
  const showWarning = daysUntilExpiration <= 10 && daysUntilExpiration > 0;

  if (!isExpired && !showWarning) {
    return null;
  }

  return (
    <>
      <Alert
        variant={isExpired ? "destructive" : "default"}
        className={`mb-6 ${isExpired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}
      >
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="text-lg font-semibold">
          {isExpired ? "Tu cuenta ha expirado" : `Tu cuenta expira en ${daysUntilExpiration} ${daysUntilExpiration === 1 ? "día" : "días"}`}
        </AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            <p className="text-sm">
              {isExpired ? (
                <>
                  <strong>Todos los servicios están suspendidos:</strong>
                  <br />
                  • Sincronizaciones automáticas desactivadas
                  <br />
                  • Sincronizaciones manuales bloqueadas
                  <br />
                  • No puedes crear nuevas integraciones
                  <br />
                  • Solo puedes ver logs e históricos
                </>
              ) : (
                <>
                  Tu cuenta de G4 Hub expirará el{" "}
                  <strong>{expiresAt.toLocaleDateString("es-ES")}</strong>.
                  Contacta con nosotros para renovar tu suscripción y evitar la
                  suspensión de servicios.
                </>
              )}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => setShowReactivationDialog(true)}
                variant={isExpired ? "default" : "outline"}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contactar para {isExpired ? "Reactivar" : "Renovar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
              >
                <a
                  href="https://cal.com/diego-guaigua-torres/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar Reunión
                </a>
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={showReactivationDialog} onOpenChange={setShowReactivationDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isExpired ? "Reactivar Tu Cuenta" : "Renovar Tu Suscripción"}
            </DialogTitle>
            <DialogDescription>
              {isExpired ? (
                <>
                  Tu cuenta ha expirado y los servicios están suspendidos. Para
                  reactivar tu cuenta y restaurar todos los servicios, por favor
                  contacta con nuestro equipo.
                </>
              ) : (
                <>
                  Tu cuenta expirará pronto. Renueva tu suscripción para
                  mantener activos todos los servicios de G4 Hub.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Información de tu cuenta:</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium">{user.tenant.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium capitalize">
                    {user.tenant.planType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isExpired ? "Expiró el:" : "Expira el:"}
                  </span>
                  <span className={`font-medium ${isExpired ? "text-red-600" : "text-amber-600"}`}>
                    {expiresAt.toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Opciones de contacto:</h4>

              <Button
                className="w-full"
                size="lg"
                asChild
              >
                <a
                  href="https://cal.com/diego-guaigua-torres/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  Agendar Reunión
                </a>
              </Button>

              <Button
                className="w-full"
                variant="outline"
                size="lg"
                asChild
              >
                <a href="mailto:soporte@g4hub.com">
                  <Mail className="mr-2 h-5 w-5" />
                  Enviar Email
                </a>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowReactivationDialog(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
