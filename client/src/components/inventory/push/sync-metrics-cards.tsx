import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Zap, CheckCircle, XCircle } from "lucide-react";
import { useSyncStats } from "@/hooks/use-sync-stats";
import { cn } from "@/lib/utils";

interface SyncMetricsCardsProps {
  storeId: number | null;
}

export function SyncMetricsCards({ storeId }: SyncMetricsCardsProps) {
  const { data: stats, isLoading } = useSyncStats(storeId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-10 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Pendientes",
      value: stats?.pending || 0,
      subtitle: "últimas 24h",
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "En Proceso",
      value: stats?.processing || 0,
      subtitle: "ahora",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      pulse: true,
    },
    {
      title: "Completados",
      value: stats?.completed_24h || 0,
      subtitle: "últimas 24h",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Fallidos",
      value: stats?.failed_24h || 0,
      subtitle: "últimas 24h",
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </h3>
              <div className={cn("rounded-full p-2", metric.bgColor)}>
                <metric.icon
                  className={cn(
                    "h-4 w-4",
                    metric.color,
                    metric.pulse && "animate-pulse"
                  )}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
