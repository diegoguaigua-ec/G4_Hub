import { useLocation } from "wouter";
import DashboardLayout from "../../../dashboard-layout";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Package, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContificoModulesPage() {
  const [, setLocation] = useLocation(); 

  const modules = [
    {
      id: "inventory",
      name: "Inventario",
      description: "Sincroniza productos y stock entre Contífico y tus tiendas online en tiempo real.",
      icon: Package,
      isAvailable: true,
      path: "/dashboard/integrations/contifico/inventory",
    },
    {
      id: "invoicing",
      name: "Facturación",
      description: "Genera facturas automáticamente desde tus pedidos online y envíalas a Contífico.",
      icon: FileText,
      isAvailable: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/dashboard/integrations")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Integraciones
        </Button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Contífico
              </h1>
              <p className="text-muted-foreground">
                Sistema ERP en la nube
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-lg mt-4">
            Selecciona el módulo que deseas gestionar
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {modules.map((module) => (
            <IntegrationCard
              key={module.id}
              name={module.name}
              description={module.description}
              icon={module.icon}
              isAvailable={module.isAvailable}
              onConfigure={() => {
                if (module.path) {
                  setLocation(module.path);
                }
              }}
            />
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-foreground mb-2">
            Módulos adicionales próximamente
          </h3>
          <p className="text-sm text-muted-foreground">
            Estamos trabajando en más integraciones con Contífico, incluyendo facturación electrónica, 
            gestión de compras y reportes avanzados.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}