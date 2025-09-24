import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Box, BarChart3, Store, Bot, Plug, BarChart, Settings, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionType = "overview" | "stores" | "automation" | "integrations" | "analytics" | "settings";

interface SidebarProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { user, logoutMutation } = useAuth();

  const navItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "stores", label: "Stores", icon: Store },
    { id: "automation", label: "Automation", icon: Bot, badge: "Beta" },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "analytics", label: "Analytics", icon: BarChart },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Box className="h-4 w-4 text-secondary" />
        </div>
        <span className="text-xl font-bold text-foreground">G4 Hub</span>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-12 font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  onClick={() => onSectionChange(item.id as SectionType)}
                  data-testid={`nav-${item.id}`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  {(item as any).badge && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                      {(item as any).badge}
                    </span>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">
              {user?.name || "User"}
            </p>
            <p className="text-muted-foreground text-xs truncate">
              {user?.email || "user@company.com"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
