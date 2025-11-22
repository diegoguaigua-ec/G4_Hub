// Plan configuration for G4 Hub platform

export type PlanType = "starter" | "professional" | "enterprise";

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
}

export interface PlanLimits {
  maxStores: number | "unlimited";
  maxProducts: number | "unlimited";
  maxIntegrations: number | "unlimited";
  maxMonthlyOrders: number | "unlimited";
  maxMonthlySyncs: number | "unlimited"; // Manual sync limit per month
  syncInterval: number; // minutes
  supportLevel: "email" | "priority" | "dedicated";
  customBranding: boolean;
  apiAccess: boolean;
  advancedReporting: boolean;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  price: {
    monthly: number;
    annual: number;
  };
  limits: PlanLimits;
  features: PlanFeature[];
  popular: boolean;
}

export const PLANS: Record<PlanType, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Ideal para pequeños negocios que están comenzando con la automatización",
    price: {
      monthly: 0,
      annual: 0,
    },
    limits: {
      maxStores: 1,
      maxProducts: 100,
      maxIntegrations: 1,
      maxMonthlyOrders: 50,
      maxMonthlySyncs: 30, // 30 manual syncs per month
      syncInterval: 60, // 1 hour
      supportLevel: "email",
      customBranding: false,
      apiAccess: false,
      advancedReporting: false,
    },
    features: [
      {
        name: "1 Tienda Conectada",
        description: "Conecta una tienda de Shopify o WooCommerce",
        included: true,
      },
      {
        name: "1 Integración ERP",
        description: "Conecta con Contífico",
        included: true,
      },
      {
        name: "Hasta 100 Productos",
        description: "Sincroniza hasta 100 productos",
        included: true,
      },
      {
        name: "Sincronización Cada Hora",
        description: "Actualización automática de inventario cada 60 minutos",
        included: true,
      },
      {
        name: "Soporte por Email",
        description: "Asistencia vía correo electrónico",
        included: true,
      },
      {
        name: "Panel de Control Básico",
        description: "Dashboard con métricas esenciales",
        included: true,
      },
      {
        name: "Reportes Avanzados",
        description: "Análisis detallado de sincronizaciones",
        included: false,
      },
      {
        name: "Acceso a API",
        description: "Integra con tus propias aplicaciones",
        included: false,
      },
    ],
    popular: false,
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "Para negocios en crecimiento que necesitan mayor capacidad y funcionalidades",
    price: {
      monthly: 49,
      annual: 490, // ~16% discount
    },
    limits: {
      maxStores: 5,
      maxProducts: 5000,
      maxIntegrations: 3,
      maxMonthlyOrders: 500,
      maxMonthlySyncs: 300, // 300 manual syncs per month
      syncInterval: 15, // 15 minutes
      supportLevel: "priority",
      customBranding: false,
      apiAccess: true,
      advancedReporting: true,
    },
    features: [
      {
        name: "Hasta 5 Tiendas",
        description: "Gestiona múltiples tiendas desde un solo lugar",
        included: true,
      },
      {
        name: "Hasta 3 Integraciones ERP",
        description: "Conecta con múltiples sistemas ERP",
        included: true,
      },
      {
        name: "Hasta 5,000 Productos",
        description: "Sincroniza inventario extenso",
        included: true,
      },
      {
        name: "Sincronización Cada 15min",
        description: "Actualizaciones más frecuentes para mayor precisión",
        included: true,
      },
      {
        name: "Soporte Prioritario",
        description: "Asistencia con tiempos de respuesta más rápidos",
        included: true,
      },
      {
        name: "Reportes Avanzados",
        description: "Análisis detallado con gráficas y exportación",
        included: true,
      },
      {
        name: "Acceso a API REST",
        description: "Integra nuestros servicios en tus aplicaciones",
        included: true,
      },
      {
        name: "Webhooks Personalizados",
        description: "Notificaciones en tiempo real de eventos",
        included: true,
      },
      {
        name: "Marca Personalizada",
        description: "Logo y colores corporativos",
        included: false,
      },
    ],
    popular: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Solución completa para empresas con necesidades personalizadas",
    price: {
      monthly: 199,
      annual: 1990, // ~16% discount
    },
    limits: {
      maxStores: "unlimited",
      maxProducts: "unlimited",
      maxIntegrations: "unlimited",
      maxMonthlyOrders: "unlimited",
      maxMonthlySyncs: "unlimited", // Unlimited manual syncs
      syncInterval: 5, // 5 minutes
      supportLevel: "dedicated",
      customBranding: true,
      apiAccess: true,
      advancedReporting: true,
    },
    features: [
      {
        name: "Tiendas Ilimitadas",
        description: "Sin restricción en el número de tiendas",
        included: true,
      },
      {
        name: "Integraciones Ilimitadas",
        description: "Conecta todos los sistemas que necesites",
        included: true,
      },
      {
        name: "Productos Ilimitados",
        description: "Catalogo sin límites",
        included: true,
      },
      {
        name: "Sincronización Cada 5min",
        description: "Actualización casi en tiempo real",
        included: true,
      },
      {
        name: "Soporte Dedicado",
        description: "Gerente de cuenta asignado",
        included: true,
      },
      {
        name: "Marca Personalizada",
        description: "White-label completo",
        included: true,
      },
      {
        name: "API Completa",
        description: "Acceso total a todas las funcionalidades vía API",
        included: true,
      },
      {
        name: "SLA Garantizado",
        description: "99.9% de uptime garantizado",
        included: true,
      },
      {
        name: "Integraciones Personalizadas",
        description: "Desarrollamos conectores específicos para tu negocio",
        included: true,
      },
      {
        name: "Capacitación Incluida",
        description: "Onboarding y training para tu equipo",
        included: true,
      },
    ],
    popular: false,
  },
};

// Helper function to get plan by type
export function getPlan(planType: PlanType): Plan {
  return PLANS[planType];
}

// Helper function to check if tenant has reached a limit
export function hasReachedLimit(
  planType: PlanType,
  limitType: keyof PlanLimits,
  currentValue: number
): boolean {
  const plan = getPlan(planType);
  const limit = plan.limits[limitType];
  
  if (limit === "unlimited") return false;
  if (typeof limit === "number") return currentValue >= limit;
  return false;
}

// Get formatted price for display
export function formatPrice(price: number): string {
  if (price === 0) return "Gratis";
  return `$${price}`;
}

// Get all plans as array
export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

// Plan comparison data for landing page
export const PLAN_COMPARISON_FEATURES = [
  { category: "Límites", features: [
    { name: "Tiendas Conectadas", starter: "1", professional: "5", enterprise: "Ilimitadas" },
    { name: "Productos", starter: "100", professional: "5,000", enterprise: "Ilimitados" },
    { name: "Integraciones ERP", starter: "1", professional: "3", enterprise: "Ilimitadas" },
    { name: "Órdenes Mensuales", starter: "50", professional: "500", enterprise: "Ilimitadas" },
  ]},
  { category: "Sincronización", features: [
    { name: "Intervalo de Sync", starter: "60min", professional: "15min", enterprise: "5min" },
    { name: "Sync Manual", starter: "✓", professional: "✓", enterprise: "✓" },
  ]},
  { category: "Funcionalidades", features: [
    { name: "Panel de Control", starter: "Básico", professional: "Avanzado", enterprise: "Completo" },
    { name: "Reportes Avanzados", starter: "✗", professional: "✓", enterprise: "✓" },
    { name: "Acceso a API", starter: "✗", professional: "✓", enterprise: "✓" },
    { name: "Webhooks", starter: "✗", professional: "✓", enterprise: "✓" },
    { name: "Marca Personalizada", starter: "✗", professional: "✗", enterprise: "✓" },
  ]},
  { category: "Soporte", features: [
    { name: "Nivel de Soporte", starter: "Email", professional: "Prioritario", enterprise: "Dedicado" },
    { name: "SLA", starter: "✗", professional: "✗", enterprise: "99.9%" },
    { name: "Capacitación", starter: "✗", professional: "✗", enterprise: "✓" },
  ]},
];
