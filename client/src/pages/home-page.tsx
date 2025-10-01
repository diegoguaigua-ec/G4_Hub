import { useState } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import OverviewSection from "@/components/dashboard/overview-section";
import AutomationSection from "@/components/dashboard/automation-section";
import StoresSection from "@/components/dashboard/stores-section";
import IntegrationsSection from "@/components/dashboard/integrations-section";

type SectionType = "overview" | "stores" | "automation" | "integrations" | "analytics" | "settings";

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<SectionType>("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "automation":
        return <AutomationSection />;
      case "stores":
        return <StoresSection />;
      case "integrations":
        return <IntegrationsSection />;
      case "analytics":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Analítica</h2>
                <p className="text-muted-foreground">Información detallada sobre el rendimiento de tu e-commerce</p>
              </div>
            </div>
            <div className="text-center py-12">
              <p className="text-muted-foreground">La analítica estará disponible próximamente</p>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Configuración</h2>
                <p className="text-muted-foreground">Configura tus preferencias de G4 Hub</p>
              </div>
            </div>
            <div className="text-center py-12">
              <p className="text-muted-foreground">La configuración estará disponible próximamente</p>
            </div>
          </div>
        );
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="ml-64">
        {/* Header removido - cada sección maneja su propio encabezado */}
        <main className="p-8">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}