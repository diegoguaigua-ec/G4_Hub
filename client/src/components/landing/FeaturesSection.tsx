import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import {
  RefreshCw,
  Store,
  Zap,
  Activity,
  Settings,
  Headphones,
} from "lucide-react";

interface Feature {
  icon: any;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: RefreshCw,
    title: "Sincronización Bidireccional",
    description:
      "Actualiza stock desde Contífico a tus tiendas (Pull) y envía movimientos de ventas al ERP (Push). Sincronización completa en ambas direcciones.",
  },
  {
    icon: Store,
    title: "Multi-tienda Nativa",
    description:
      "Conecta múltiples tiendas Shopify y WooCommerce con una sola cuenta. Gestión centralizada de inventario entre todas tus plataformas.",
  },
  {
    icon: Zap,
    title: "Webhooks en Tiempo Real",
    description:
      "Sistema de webhooks que detecta cambios al instante. Tus tiendas se actualizan automáticamente cuando hay ventas o ajustes de inventario.",
  },
  {
    icon: Activity,
    title: "Logs y Auditoría Completa",
    description:
      "Revisa cada sincronización con logs detallados. Filtra por tienda, fecha y estado. Identifica y resuelve problemas rápidamente.",
  },
  {
    icon: Settings,
    title: "Configuración Flexible",
    description:
      "Configura intervalos de sincronización, selecciona bodegas específicas y define reglas por tienda. Control total sobre tu automatización.",
  },
  {
    icon: Headphones,
    title: "Soporte en Español",
    description:
      "Soporte técnico en español con conocimiento del mercado latinoamericano. Ayuda con integración de Contífico, Shopify y WooCommerce.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Todo lo que Necesitas para Automatizar tu E-commerce
          </h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            Funcionalidades diseñadas para el mercado latinoamericano
          </p>
        </AnimatedSection>

        {/* Features Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <StaggerItem key={feature.title}>
              <motion.div
                whileHover={{
                  y: -5,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative bg-card border rounded-xl p-6 h-full hover:border-primary/50 transition-colors"
              >
                {/* Icon with animation */}
                <motion.div
                  whileHover={{
                    rotate: [0, -10, 10, -10, 0],
                    scale: 1.1,
                  }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors"
                >
                  <feature.icon className="w-7 h-7 text-primary" />
                </motion.div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative gradient border on hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom Note */}
        <AnimatedSection delay={0.5} className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            ¿Necesitas una característica específica?{" "}
            <a
              href="#footer"
              className="text-primary hover:underline font-medium"
              onClick={(e) => {
                e.preventDefault();
                const element = document.querySelector("#footer");
                if (element) {
                  const offset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                }
              }}
            >
              Contáctanos
            </a>{" "}
            y hablemos de tu caso de uso.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
