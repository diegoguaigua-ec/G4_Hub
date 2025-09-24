import { useState } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import OverviewSection from "@/components/dashboard/overview-section";
import AutomationSection from "@/components/dashboard/automation-section";
import StoresSection from "@/components/dashboard/stores-section";

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
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Integrations</h2>
            <p className="text-muted-foreground">Connect with your favorite tools and services</p>
          </div>
        );
      case "analytics":
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Analytics</h2>
            <p className="text-muted-foreground">Detailed insights about your e-commerce performance</p>
          </div>
        );
      case "settings":
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Settings</h2>
            <p className="text-muted-foreground">Configure your G4 Hub preferences</p>
          </div>
        );
      default:
        return <OverviewSection />;
    }
  };

  const getSectionInfo = (section: SectionType) => {
    const sectionInfo = {
      overview: { title: 'Overview', subtitle: 'Monitor your e-commerce automation performance' },
      stores: { title: 'Stores', subtitle: 'Manage your connected e-commerce platforms' },
      automation: { title: 'Automation', subtitle: 'Advanced AI-powered automation features' },
      integrations: { title: 'Integrations', subtitle: 'Connect with your favorite tools and services' },
      analytics: { title: 'Analytics', subtitle: 'Detailed insights about your e-commerce performance' },
      settings: { title: 'Settings', subtitle: 'Configure your G4 Hub preferences' }
    };
    return sectionInfo[section];
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="ml-64">
        <Header 
          title={getSectionInfo(activeSection).title}
          subtitle={getSectionInfo(activeSection).subtitle}
        />
        <main className="p-8">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
