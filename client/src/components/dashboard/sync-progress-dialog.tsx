import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncResult?: {
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ sku: string; error: string }>;
  } | null;
  isLoading: boolean;
}

export function SyncProgressDialog({
  open,
  onOpenChange,
  syncResult,
  isLoading,
}: SyncProgressDialogProps) {
  const [dots, setDots] = useState('');

  // Animación de puntos suspensivos
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const total = syncResult
    ? syncResult.success + syncResult.failed + syncResult.skipped
    : 0;
  const hasResults = syncResult !== null && syncResult !== undefined;
  const hasErrors = syncResult && syncResult.failed > 0;
  const isComplete = hasResults && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isLoading && 'Sincronizando inventario'}
            {isComplete && !hasErrors && 'Sincronización completada'}
            {isComplete && hasErrors && 'Sincronización completada con errores'}
          </DialogTitle>
          <DialogDescription>
            {isLoading && `Procesando productos${dots}`}
            {isComplete && !hasErrors && 'El inventario se ha actualizado correctamente'}
            {isComplete && hasErrors && 'Algunos productos no pudieron sincronizarse'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Estado de carga */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Consultando stock en Contífico y actualizando productos...
              </p>
            </div>
          )}

          {/* Resultados */}
          {isComplete && syncResult && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center space-y-2 rounded-lg border p-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="text-center">
                    <p className="text-2xl font-bold">{syncResult.success}</p>
                    <p className="text-xs text-muted-foreground">Actualizados</p>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-2 rounded-lg border p-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div className="text-center">
                    <p className="text-2xl font-bold">{syncResult.failed}</p>
                    <p className="text-xs text-muted-foreground">Fallidos</p>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-2 rounded-lg border p-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div className="text-center">
                    <p className="text-2xl font-bold">{syncResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Omitidos</p>
                  </div>
                </div>
              </div>

              {/* Errores (si existen) */}
              {hasErrors && syncResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      {syncResult.failed} producto(s) no pudieron sincronizarse:
                    </p>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {syncResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="truncate">
                          <span className="font-mono">{error.sku}</span>: {error.error}
                        </li>
                      ))}
                      {syncResult.errors.length > 5 && (
                        <li className="text-muted-foreground">
                          ... y {syncResult.errors.length - 5} más
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Mensaje de éxito */}
              {!hasErrors && syncResult.success > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    Se actualizaron exitosamente {syncResult.success} productos desde
                    Contífico.
                  </AlertDescription>
                </Alert>
              )}

              {/* Productos omitidos */}
              {syncResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {syncResult.skipped} productos fueron omitidos (no encontrados en
                  Contífico o stock sin cambios)
                </p>
              )}
            </>
          )}
        </div>

        {/* Botón de cierre */}
        {isComplete && (
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}