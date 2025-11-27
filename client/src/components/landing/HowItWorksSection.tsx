import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import AnimatedSection from "./AnimatedSection";
import { Plug, Settings, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface Step {
  number: string;
  icon: any;
  title: string;
  description: string;
  visual: string;
}

const steps: Step[] = [
  {
    number: "01",
    icon: Plug,
    title: "Conecta tus Tiendas",
    description:
      "Conecta tus tiendas Shopify o WooCommerce con OAuth seguro. Solo necesitas las credenciales de tu tienda.",
    visual: "Formulario de conexión de tienda",
  },
  {
    number: "02",
    icon: Settings,
    title: "Configura Contífico",
    description:
      "Agrega tus credenciales de API de Contífico y selecciona la bodega a sincronizar. Probamos la conexión automáticamente.",
    visual: "Formulario de integración",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Activa la Automatización",
    description:
      "Vincula la integración a tu tienda, configura el intervalo de sincronización y activa. ¡Listo! El sistema se encarga del resto.",
    visual: "Dashboard con tienda activa",
  },
];

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Transform scroll progress to line height
  const lineHeight = useTransform(scrollYProgress, [0.2, 0.8], ["0%", "100%"]);

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="py-20 lg:py-28 bg-black relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5 -z-10" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Comienza en 3 Simples Pasos
          </h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            De la configuración a la automatización completa en minutos
          </p>
        </AnimatedSection>

        {/* Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical connecting line - desktop only */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2">
            <div className="relative w-full h-full bg-border">
              <motion.div
                style={{ height: lineHeight }}
                className="absolute top-0 left-0 w-full bg-gradient-to-b from-primary to-secondary origin-top"
              />
            </div>
          </div>

          {/* Steps container */}
          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, index) => {
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.2,
                    ease: [0.21, 0.47, 0.32, 0.98],
                  }}
                  className={`relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center ${
                    isEven ? "" : "lg:direction-rtl"
                  }`}
                >
                  {/* Content side */}
                  <div
                    className={`relative ${
                      isEven ? "lg:text-right lg:pr-16" : "lg:text-left lg:pl-16 lg:col-start-2"
                    }`}
                  >
                    {/* Step number */}
                    <div className="inline-block mb-4">
                      <span className="text-6xl lg:text-7xl font-bold text-white opacity-90 font-extrabold">
                        {step.number}
                      </span>
                    </div>

                    {/* Icon and title */}
                    <div className={`flex items-center gap-4 mb-4 ${isEven ? "lg:justify-end" : "lg:justify-start"}`}>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {step.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual side - placeholder */}
                  <div
                    className={`relative ${
                      isEven ? "lg:pl-16" : "lg:pr-16 lg:col-start-1 lg:row-start-1"
                    }`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative bg-gradient-to-br from-card to-card/80 border rounded-2xl p-6 shadow-lg aspect-video flex items-center justify-center"
                    >
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <step.icon className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {step.visual}
                        </p>
                      </div>
                    </motion.div>
                  </div>

                  {/* Center dot indicator - desktop only */}
                  <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.2 + 0.3 }}
                      className="w-4 h-4 bg-primary rounded-full border-4 border-background"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <AnimatedSection delay={0.6} className="text-center mt-16">
          <p className="text-gray-300 mb-6">
            ¿Listo para comenzar? Setup rápido y sin permanencia
          </p>
          <Link href="/auth?tab=register">
            <Button size="lg" className="text-base px-8 shadow-lg hover:shadow-xl transition-shadow">
              Comenzar Ahora
            </Button>
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
