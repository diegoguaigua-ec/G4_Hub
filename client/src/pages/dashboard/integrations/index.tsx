import { useLocation  } from "wouter";
import DashboardLayout from "../../dashboard-layout";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { 
  Database, 
  FileText, 
  Truck,
  Calculator,
  Package2
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  isAvailable: boolean;
  path?: string;
  category: "accounting" | "logistics";
}

export default function IntegrationsPage() {
  const [, setLocation] = useLocation();

  const integrations: Integration[] = [
    {
      id: "contifico",
      name: "Contífico",
      description: "Sistema ERP en la nube para gestión contable, inventario y facturación electrónica.",
      icon: Database,
      isAvailable: true,
      path: "/dashboard/integrations/contifico",
      category: "accounting",
    },
    {
      id: "datil",
      name: "Dátil",
      description: "Facturación electrónica automática y cumplimiento tributario en tiempo real.",
      icon: FileText,
      isAvailable: false,
      category: "accounting",
    },
    {
      id: "servientrega",
      name: "Servientrega",
      description: "Gestión de envíos, seguimiento de pedidos y logística integrada.",
      icon: Truck,
      isAvailable: false,
      category: "logistics",
    },
  ];

  const accountingIntegrations = integrations.filter(i => i.category === "accounting");
  const logisticsIntegrations = integrations.filter(i => i.category === "logistics");

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Integraciones
          </h1>
          <p className="text-muted-foreground text-lg">
            Conecta G4 Hub con tus sistemas de contabilidad y logística
          </p>
        </div>

        {/* Accounting Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Contabilidad
              </h2>
              <p className="text-sm text-muted-foreground">
                ERP, facturación y gestión financiera
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accountingIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                name={integration.name}
                description={integration.description}
                icon={integration.icon}
                isAvailable={integration.isAvailable}
                onConfigure={() => {
                  if (integration.path) {
                    setLocation(integration.path);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Logistics Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Package2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Logística
              </h2>
              <p className="text-sm text-muted-foreground">
                Envíos, tracking y gestión de entregas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {logisticsIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                name={integration.name}
                description={integration.description}
                icon={integration.icon}
                isAvailable={integration.isAvailable}
                onConfigure={() => {
                  if (integration.path) {
                    setLocation(integration.path);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 p-6 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                ¿Necesitas otra integración?
              </h3>
              <p className="text-sm text-muted-foreground">
                Estamos agregando nuevas integraciones constantemente. Si necesitas conectar con un sistema específico, 
                contáctanos y trabajaremos en incluirlo en nuestra plataforma.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}