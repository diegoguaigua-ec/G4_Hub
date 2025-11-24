/**
 * Configuración centralizada de planes y límites
 * Este archivo es la FUENTE ÚNICA DE VERDAD para todos los planes de G4 Hub
 * Importar desde aquí garantiza consistencia entre frontend y backend
 */

export interface PlanLimits {
  stores: number;
  products: number;
  syncs: number;
}

export interface PlanConfig {
  id: string;
  name: string;
  price: string;
  priceMonthly: string;
  description: string;
  features: string[];
  limits: PlanLimits;
  popular?: boolean;
}

/**
 * Definición oficial de planes de G4 Hub
 * NUNCA modificar estos valores sin actualizar también la documentación y comunicación con clientes
 */
export const PLANS: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
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
    id: "professional",
    name: "Professional",
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
    id: "enterprise",
    name: "Enterprise",
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

/**
 * Obtener configuración de un plan por su ID
 * @param planId - ID del plan (starter, professional, enterprise)
 * @returns Configuración del plan o undefined si no existe
 */
export function getPlanById(planId: string): PlanConfig | undefined {
  return PLANS.find((plan) => plan.id === planId);
}

/**
 * Obtener límites de un plan por su ID
 * @param planId - ID del plan (starter, professional, enterprise)
 * @returns Límites del plan o límites del plan starter por defecto
 */
export function getPlanLimits(planId: string): PlanLimits {
  const plan = getPlanById(planId);
  return plan?.limits || PLANS[0].limits;
}

/**
 * Verificar si un plan tiene límites ilimitados
 * @param planId - ID del plan
 * @returns true si el plan tiene recursos ilimitados
 */
export function isUnlimitedPlan(planId: string): boolean {
  const limits = getPlanLimits(planId);
  return limits.stores === Infinity && limits.products === Infinity && limits.syncs === Infinity;
}

/**
 * Obtener el plan por defecto (Starter)
 */
export function getDefaultPlan(): PlanConfig {
  return PLANS[0];
}

/**
 * Obtener el plan más popular
 */
export function getPopularPlan(): PlanConfig | undefined {
  return PLANS.find((plan) => plan.popular);
}
