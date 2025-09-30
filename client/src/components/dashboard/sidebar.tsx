import { Button } from "@/components/ui/button";
import { BarChart, Store, Zap, Plug, TrendingUp, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type SectionType = "overview" | "stores" | "automation" | "integrations" | "analytics" | "settings";

interface SidebarProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { logoutMutation, user } = useAuth();

  const menuItems = [
    { id: "overview" as SectionType, label: "Resumen", icon: BarChart },
    { id: "stores" as SectionType, label: "Tiendas", icon: Store },
    { id: "automation" as SectionType, label: "Automatización", icon: Zap, badge: "Beta" },
    { id: "integrations" as SectionType, label: "Integraciones", icon: Plug },
    { id: "analytics" as SectionType, label: "Analítica", icon: TrendingUp },
    { id: "settings" as SectionType, label: "Configuración", icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">G4 Hub</h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => onSectionChange(item.id)}
              data-testid={`nav-${item.id}`}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
              {item.badge && (
                <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-primary font-medium text-sm">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name || "Usuario"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Cuenta activa
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
}