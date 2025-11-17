import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Zap, Store, Package, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Store as StoreType } from "@shared/schema";

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  planType: string;
  status: string;
}

const plans = [
  {
    name: "Starter",
    id: "starter",
    price: "$15",
    priceMonthly: "$18",
    description: "Perfecto para empezar",
    features: [
      "1 tienda conectada",
      "50 productos sincronizados",
      "1,000 sincronizaciones/mes",
      "Soporte por email",
    ],
    limits: {
      stores: 1,
      products: 50,
      syncs: 1000,
    },
  },
  {
    name: "Professional",
    id: "professional",
    price: "$25",
    priceMonthly: "$35",
    description: "Para negocios en crecimiento",
    features: [
      "Hasta 3 tiendas conectadas",
      "500 productos sincronizados",
      "10,000 sincronizaciones/mes",
      "Soporte prioritario",
    ],
    limits: {
      stores: 3,
      products: 500,
      syncs: 10000,
    },
    popular: true,
  },
  {
    name: "Enterprise",
    id: "enterprise",
    price: "Contactar",
    priceMonthly: "Contactar",
    description: "Para grandes empresas",
    features: [
      "Tiendas ilimitadas",
      "Productos ilimitados",
      "Sincronizaciones ilimitadas",
      "Soporte 24/7",
      "Manager dedicado",
      "SLA personalizado",
    ],
    limits: {
      stores: Infinity,
      products: Infinity,
      syncs: Infinity,
    },
  },
];

export default function BillingSection() {
  // Fetch tenant data
  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/current"],
  });

  // Fetch stores for usage calculation
  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreType[]>({
    queryKey: ["/api/stores"],
  });

  // Fetch sync stats for usage calculation (simplified - needs backend endpoint)
  const { data: syncStats } = useQuery({
    queryKey: ["/api/sync/stats"],
    queryFn: async () => {
      const res = await fetch("/api/sync/stats?days=30", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json();
    },
  });

  const currentPlan = plans.find((p) => p.id === tenant?.planType) || plans[0];

  // Calculate usage
  const storesCount = stores.length;
  const productsCount = stores.reduce((total, store) => total + (store.productsCount || 0), 0);
  const syncsCount = syncStats?.metrics?.totalSyncs || 0;

  // Calculate percentages
  const storesPercentage = currentPlan.limits.stores === Infinity
    ? 0
    : Math.min((storesCount / currentPlan.limits.stores) * 100, 100);
  const productsPercentage = currentPlan.limits.products === Infinity
    ? 0
    : Math.min((productsCount / currentPlan.limits.products) * 100, 100);
  const syncsPercentage = currentPlan.limits.syncs === Infinity
    ? 0
    : Math.min((syncsCount / currentPlan.limits.syncs) * 100, 100);

  if (tenantLoading || storesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Actual</CardTitle>
          <CardDescription>
            Estás usando el plan {currentPlan.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-3xl font-bold">{currentPlan.price}</h3>
                {currentPlan.price !== "Contactar" && (
                  <span className="text-muted-foreground">/mes anual</span>
                )}
              </div>
              {currentPlan.priceMonthly && currentPlan.price !== "Contactar" && (
                <p className="text-sm text-muted-foreground mb-2">
                  {currentPlan.priceMonthly}/mes mensual
                </p>
              )}
              <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
            </div>
            <Badge variant={tenant?.status === "active" ? "default" : "secondary"}>
              {tenant?.status === "active" ? "Activo" : "Inactivo"}
            </Badge>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Características incluidas:</h4>
            {currentPlan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Uso Actual</CardTitle>
          <CardDescription>
            Monitor de recursos utilizados en el período actual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stores Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Tiendas Conectadas</span>
              </div>
              <span className="text-muted-foreground">
                {storesCount} / {currentPlan.limits.stores === Infinity ? "∞" : currentPlan.limits.stores}
              </span>
            </div>
            {currentPlan.limits.stores !== Infinity && (
              <Progress value={storesPercentage} className="h-2" />
            )}
          </div>

          {/* Products Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Productos Sincronizados</span>
              </div>
              <span className="text-muted-foreground">
                {productsCount.toLocaleString()} / {currentPlan.limits.products === Infinity ? "∞" : currentPlan.limits.products.toLocaleString()}
              </span>
            </div>
            {currentPlan.limits.products !== Infinity && (
              <Progress value={productsPercentage} className="h-2" />
            )}
          </div>

          {/* Syncs Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Sincronizaciones (últimos 30 días)</span>
              </div>
              <span className="text-muted-foreground">
                {syncsCount} / {currentPlan.limits.syncs === Infinity ? "∞" : currentPlan.limits.syncs}
              </span>
            </div>
            {currentPlan.limits.syncs !== Infinity && (
              <Progress value={syncsPercentage} className="h-2" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Planes Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === tenant?.planType;

            return (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular
                    ? "border-primary shadow-lg"
                    : isCurrent
                    ? "border-primary/50"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Popular</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className="bg-background">
                      Plan Actual
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.price !== "Contactar" && (
                      <span className="text-muted-foreground text-sm">/mes anual</span>
                    )}
                  </div>
                  {plan.priceMonthly && plan.price !== "Contactar" && (
                    <p className="text-sm text-muted-foreground">
                      {plan.priceMonthly}/mes mensual
                    </p>
                  )}
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? (
                      "Plan Actual"
                    ) : plan.id === "enterprise" ? (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Contactar Ventas
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Actualizar Plan
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
