import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/pages/dashboard-layout";

interface AdminStats {
  totalTenants: number;
  approvedTenants: number;
  pendingTenants: number;
  rejectedTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  recentActions: number;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const statCards = [
    {
      title: "Total Tenants",
      value: stats?.totalTenants || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Aprobados",
      value: stats?.approvedTenants || 0,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Pendientes",
      value: stats?.pendingTenants || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Rechazados",
      value: stats?.rejectedTenants || 0,
      icon: UserX,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Total Usuarios",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Acciones Recientes",
      value: stats?.recentActions || 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel Administrativo</h1>
          <p className="text-muted-foreground">
            Gestión de cuentas y usuarios del sistema
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              {statCards.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <a
                href="/dashboard/admin/users?filter=pending"
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium">Revisar Cuentas Pendientes</p>
                  <p className="text-sm text-muted-foreground">
                    {stats?.pendingTenants || 0} cuentas esperando aprobación
                  </p>
                </div>
              </a>

              <a
                href="/dashboard/admin/users"
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Gestionar Usuarios</p>
                  <p className="text-sm text-muted-foreground">
                    Ver, editar y administrar todos los usuarios
                  </p>
                </div>
              </a>

              <a
                href="/dashboard/admin/audit-logs"
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="p-2 rounded-lg bg-purple-100">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Ver Logs de Auditoría</p>
                  <p className="text-sm text-muted-foreground">
                    {stats?.recentActions || 0} acciones registradas
                  </p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
