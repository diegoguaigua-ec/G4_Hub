import { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Clock, Target, TrendingDown, Zap } from "lucide-react";

interface Benefit {
  icon: any;
  metric: string;
  number?: number;
  suffix?: string;
  title: string;
  description: string;
}

const benefits: Benefit[] = [
  {
    icon: Clock,
    metric: "80% menos tiempo",
    number: 80,
    suffix: "%",
    title: "Reducción en Tareas Manuales",
    description:
      "Elimina la actualización manual de inventario entre tu tienda y ERP. Lo que tomaba horas ahora sucede automáticamente en segundos.",
  },
  {
    icon: Target,
    metric: "99.9% precisión",
    number: 99.9,
    suffix: "%",
    title: "Sincronización sin Errores",
    description:
      "Evita sobreventa y desabastecimiento con sincronización bidireccional en tiempo real. Tus clientes siempre ven stock actualizado.",
  },
  {
    icon: TrendingDown,
    metric: "40% ahorro",
    number: 40,
    suffix: "%",
    title: "Menos Costos Operacionales",
    description:
      "Automatiza procesos repetitivos y libera a tu equipo para tareas estratégicas. Reduce errores costosos de inventario y facturación.",
  },
  {
    icon: Zap,
    metric: "3x más rápido",
    number: 3,
    suffix: "x",
    title: "Crece sin Agregar Personal",
    description:
      "Gestiona múltiples tiendas y miles de productos sin aumentar tu equipo operativo. La plataforma escala contigo automáticamente.",
  },
];

function CounterAnimation({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [hasAnimated, setHasAnimated] = useState(false);

  const springValue = useSpring(0, {
    duration: 2000,
    bounce: 0,
  });

  const display = useTransform(springValue, (latest) => {
    // Handle decimal numbers
    if (value % 1 !== 0) {
      return latest.toFixed(1);
    }
    return Math.floor(latest).toString();
  });

  useEffect(() => {
    if (isInView && !hasAnimated) {
      springValue.set(value);
      setHasAnimated(true);
    }
  }, [isInView, value, springValue, hasAnimated]);

  return (
    <span ref={ref}>
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

export default function BenefitsSection() {
  return (
    <section id="benefits" className="py-20 lg:py-28 bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Transforma tu Operación E-commerce
          </h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            G4 Hub elimina tareas manuales y errores costosos en tu proceso post-venta
          </p>
        </AnimatedSection>

        {/* Benefits Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {benefits.map((benefit, index) => (
            <StaggerItem key={benefit.title}>
              <motion.div
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative bg-card border rounded-2xl p-8 shadow-lg hover:border-primary/50 transition-colors"
              >
                {/* Icon */}
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-8 h-8 text-primary" />
                </div>

                {/* Metric */}
                <div className="mb-4">
                  <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">
                    {benefit.number ? (
                      <CounterAnimation value={benefit.number} suffix={benefit.suffix} />
                    ) : (
                      benefit.metric
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {benefit.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>

                {/* Decorative Element */}
                <div className="absolute top-4 right-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom CTA */}
        <AnimatedSection delay={0.4} className="text-center mt-16">
          <p className="text-gray-300 mb-4">
            ¿Listo para optimizar tu operación e-commerce?
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <button
              onClick={() => {
                const element = document.querySelector("#pricing");
                if (element) {
                  const offset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                }
              }}
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              Ver Planes y Precios
            </button>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}
