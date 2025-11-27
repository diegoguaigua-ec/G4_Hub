import { useState } from "react";
import { motion } from "framer-motion";
import AnimatedSection, { StaggerContainer, StaggerItem } from "./AnimatedSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { Link } from "wouter";
import { PLANS } from "@shared/plans-config";

type BillingPeriod = "annual" | "monthly";

export default function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Planes que Escalan con tu Negocio
          </h2>
          <p className="text-gray-300 max-w-3xl mx-auto">
            Precios transparentes sin sorpresas
          </p>
        </AnimatedSection>

        {/* Billing Period Toggle - Glass Style */}
        <AnimatedSection delay={0.1} className="flex items-center justify-center gap-4 mb-12">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-1.5 shadow-lg">
            <button
              onClick={() => setBillingPeriod("annual")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${
                billingPeriod === "annual"
                  ? "bg-white/20 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Anual
            </button>
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${
                billingPeriod === "monthly"
                  ? "bg-white/20 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Mensual
            </button>
          </div>
          {billingPeriod === "annual" && (
            <Badge className="bg-[#D2FF3D]/20 backdrop-blur-md border border-[#D2FF3D]/40 text-[#D2FF3D] font-semibold shadow-lg">
              Ahorra 29%
            </Badge>
          )}
        </AnimatedSection>

        {/* Pricing Cards Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {PLANS.map((plan) => {
            const isPopular = plan.popular;
            const displayPrice = billingPeriod === "annual" ? plan.price : plan.priceMonthly;

            return (
              <StaggerItem key={plan.id}>
                <motion.div
                  whileHover={{
                    scale: isPopular ? 1.02 : 1.05,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`relative bg-card border rounded-2xl p-8 h-full flex flex-col ${
                    isPopular
                      ? "border-primary shadow-2xl scale-105 lg:scale-110"
                      : "hover:border-primary/50"
                  }`}
                >
                  {/* Popular Badge with green lime text */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#D2FF3D]/20 backdrop-blur-md border border-[#D2FF3D]/40 text-[#D2FF3D] font-bold px-4 py-1.5 rounded-full shadow-lg shadow-[#D2FF3D]/20">
                        Popular
                      </Badge>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl lg:text-5xl font-bold text-foreground">
                        {displayPrice}
                      </span>
                      {displayPrice !== "Contactar" && (
                        <span className="text-muted-foreground">
                          /mes {billingPeriod === "annual" ? "anual" : "mensual"}
                        </span>
                      )}
                    </div>
                    {billingPeriod === "annual" && plan.priceMonthly !== "Contactar" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.priceMonthly}/mes si pagas mensualmente
                      </p>
                    )}
                    <p className="text-muted-foreground mt-3">{plan.description}</p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA Button - Green lime with liquid glass for popular */}
                  <a href="https://cal.com/diego-guaigua-torres/30min" target="_blank" rel="noopener noreferrer" className="w-full">
                    {isPopular ? (
                      <button className="w-full px-6 py-3 bg-[#D2FF3D]/90 backdrop-blur-sm border border-[#D2FF3D]/50 rounded-lg text-black font-semibold hover:bg-[#D2FF3D] hover:text-black hover:shadow-xl hover:shadow-[#D2FF3D]/50 active:scale-95 transition-all duration-300 shadow-lg shadow-[#D2FF3D]/30 flex items-center justify-center gap-2">
                        <Zap className="h-4 w-4" />
                        Agendar Demo
                      </button>
                    ) : (
                      <button className="w-full px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white font-semibold hover:bg-white/20 hover:border-white/30 active:scale-95 transition-all duration-300 shadow-md flex items-center justify-center gap-2">
                        <Zap className="h-4 w-4" />
                        Agendar Demo
                      </button>
                    )}
                  </a>

                  {/* Decorative gradient for popular plan */}
                  {isPopular && (
                    <>
                      <div className="glow-primary-static absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full" />
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 -z-10 blur-2xl" />
                    </>
                  )}
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Bottom Note */}
        <AnimatedSection delay={0.5} className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Todos los planes incluyen actualizaciones gratuitas y soporte técnico.{" "}
            <br className="hidden sm:block" />
            ¿Preguntas sobre planes?{" "}
            <button
              onClick={() => scrollToSection("#footer")}
              className="text-primary hover:underline font-medium"
            >
              Contáctanos
            </button>
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
