import { useState } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import OverviewSection from "@/components/dashboard/overview-section";
import StoresSection from "@/components/dashboard/stores-section";
import AutomationSection from "@/components/dashboard/automation-section";
import IntegrationsSection from "@/components/dashboard/integrations-section";
import SyncLogsSection from "@/components/dashboard/sync-logs-section";

type SectionType = "overview" | "stores" | "automation" | "integrations" | "analytics" | "settings" | "sync-logs";

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<SectionType>("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "stores":
        return <StoresSection />;
      case "sync-logs":
        return <SyncLogsSection />;
      case "automation":
        return <AutomationSection />;
      case "integrations":
        return <IntegrationsSection />;
      case "analytics":
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">Analítica</h2>
            <p className="text-muted-foreground">Sección en desarrollo</p>
          </div>
        );
      case "settings":
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">Configuración</h2>
            <p className="text-muted-foreground">Sección en desarrollo</p>
          </div>
        );
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="ml-64 p-8">
        {renderSection()}
      </main>
    </div>
  );
}