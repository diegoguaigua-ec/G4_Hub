import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, RefreshCw, FileText, Clock, Check, FilePlus, Plus, BarChart, Settings } from "lucide-react";

export default function OverviewSection() {
  const stats = [
    {
      title: "Connected Stores",
      value: "8",
      change: "+12%",
      icon: Store,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Products Synced",
      value: "1,247",
      change: "+8%",
      icon: RefreshCw,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Automated Invoices",
      value: "342",
      change: "+24%",
      icon: FileText,
      color: "bg-primary/10 text-primary"
    },
    {
      title: "Avg. Sync Time",
      value: "24h",
      change: "98.5%",
      icon: Clock,
      color: "bg-primary/10 text-primary"
    },
  ];

  const recentActivity = [
    {
      title: "Inventory sync completed",
      store: "Mi Tienda Online",
      time: "2 min ago",
      icon: Check,
    },
    {
      title: "Invoice #INV-2024-001 generated",
      store: "Ecommerce Store",
      time: "5 min ago",
      icon: FileText,
    },
    {
      title: "New store connected",
      store: "Boutique Fashion",
      time: "15 min ago",
      icon: Plus,
    },
  ];

  const quickActions = [
    { title: "Add Store", icon: Store },
    { title: "Force Sync", icon: RefreshCw },
    { title: "View Reports", icon: BarChart },
    { title: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-foreground" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </h3>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              <Button variant="ghost" className="text-primary hover:text-primary/80 text-sm font-medium p-0">
                View all
              </Button>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center gap-4" data-testid={`activity-${index}`}>
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{activity.title}</p>
                      <p className="text-muted-foreground text-sm">{activity.store} • {activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-3 group hover:bg-muted/50"
                    data-testid={`action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-medium text-foreground text-sm">{action.title}</p>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
