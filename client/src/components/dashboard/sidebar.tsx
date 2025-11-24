import { Button } from "@/components/ui/button";
import {
  BarChart,
  Store,
  Zap,
  Plug,
  TrendingUp,
  Settings,
  LogOut,
  Shield,
  Users,
  FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  const { logoutMutation, user } = useAuth();
  const [location] = useLocation();

  const menuItems = [
    { path: "/dashboard", label: "Resumen", icon: BarChart },
    { path: "/dashboard/stores", label: "Tiendas", icon: Store },
    // Temporalmente ocultas mientras se desarrollan
    // {
    //   path: "/dashboard/automation",
    //   label: "Automatización",
    //   icon: Zap,
    //   badge: "Beta",
    // },
    { path: "/dashboard/integrations", label: "Integraciones", icon: Plug },
    // { path: "/dashboard/analytics", label: "Analítica", icon: TrendingUp },
    { path: "/dashboard/settings", label: "Configuración", icon: Settings },
  ];

  const adminMenuItems = [
    { path: "/dashboard/admin", label: "Panel Admin", icon: Shield },
    { path: "/dashboard/admin/users", label: "Gestión de Usuarios", icon: Users },
    { path: "/dashboard/admin/audit-logs", label: "Logs de Auditoría", icon: FileText },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === "/dashboard" || location === "/";
    }
    return location.startsWith(path);
  };

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

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={active ? "default" : "ghost"}
                className={`w-full justify-start ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Button>
            </Link>
          );
        })}

        {/* Admin Section - Only visible to admins */}
        {user?.role === "admin" && (
          <>
            <Separator className="my-4" />
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administración
              </p>
            </div>
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={active ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name || "Usuario"}
            </p>
            <p className="text-xs text-muted-foreground">Cuenta activa</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
}
