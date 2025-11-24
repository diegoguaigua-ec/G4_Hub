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
    <section id="pricing" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Planes que Escalan con tu Negocio
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Precios transparentes sin sorpresas
          </p>
        </AnimatedSection>

        {/* Billing Period Toggle */}
        <AnimatedSection delay={0.1} className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-medium transition-colors ${
              billingPeriod === "annual" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Anual
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === "annual" ? "monthly" : "annual")}
            className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: billingPeriod === "annual" ? "hsl(var(--primary))" : "hsl(var(--muted))",
            }}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="inline-block h-5 w-5 rounded-full bg-background shadow-lg"
              style={{
                marginLeft: billingPeriod === "annual" ? "2px" : "calc(100% - 22px)",
              }}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Mensual
          </span>
          {billingPeriod === "annual" && (
            <Badge variant="secondary" className="ml-2">
              Ahorra 17%
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
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground shadow-lg">
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

                  {/* CTA Button */}
                  {plan.id === "enterprise" ? (
                    <Button
                      size="lg"
                      variant={isPopular ? "default" : "outline"}
                      className="w-full"
                      onClick={() => scrollToSection("#footer")}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Contactar Ventas
                    </Button>
                  ) : (
                    <Link href="/auth?tab=register">
                      <Button
                        size="lg"
                        variant={isPopular ? "default" : "outline"}
                        className="w-full"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Comenzar Ahora
                      </Button>
                    </Link>
                  )}

                  {/* Decorative gradient for popular plan */}
                  {isPopular && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 -z-10 blur-2xl" />
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
