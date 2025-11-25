import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Check,
  Play,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function HeroSection() {
  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-16 lg:pt-24 lg:pb-20 bg-[hsl(207,11%,11%)]"
    >
      {/* Decorative Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-1/4 -left-48 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0 }}
              className="space-y-6 relative"
            >
              {/* Subtle glow behind title */}
              <div className="glow-primary absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96" />

              <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-white relative z-10">
                Automatiza tu E-commerce en{" "}
                <span className="text-primary">Latinoamérica</span>
              </h1>

              <p className="text-gray-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                La plataforma que conecta tus tiendas Shopify y WooCommerce con
                Contífico y otros ERPs. Sincronización en tiempo real,
                facturación automática y gestión completa de inventario.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <a href="https://cal.com/diego-guaigua-torres/30min" target="_blank" rel="noopener noreferrer">
                <Button variant="glass-primary" size="lg" className="text-base px-8 glass-shimmer w-full sm:w-auto text-white">
                  <Zap className="mr-2 h-5 w-5" />
                  Agendar Demo
                </Button>
              </a>
              <Button
                variant="glass"
                size="lg"
                className="text-base px-8 w-full sm:w-auto"
                onClick={() => scrollToSection("#how-it-works")}
              >
                <Play className="mr-2 h-5 w-5" />
                Ver Cómo Funciona
              </Button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3 justify-center lg:justify-start"
            >
              <Badge variant="secondary" className="py-1.5 px-3 text-sm bg-white/10 backdrop-blur-md text-white border-white/20 shadow-md">
                <Check className="mr-1 h-4 w-4 text-primary" />
                Setup en 5 minutos
              </Badge>
              <Badge variant="secondary" className="py-1.5 px-3 text-sm bg-white/10 backdrop-blur-md text-white border-white/20 shadow-md">
                <Check className="mr-1 h-4 w-4 text-primary" />
                Soporte en español
              </Badge>
              <Badge variant="secondary" className="py-1.5 px-3 text-sm bg-white/10 backdrop-blur-md text-white border-white/20 shadow-md">
                <Check className="mr-1 h-4 w-4 text-primary" />
                Cancela cuando quieras
              </Badge>
            </motion.div>
          </div>

          {/* Right Column - Visual/Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="relative hidden lg:block"
          >
            <motion.div
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              {/* Central Card - Dashboard Preview with Glass Effect */}
              <div className="relative glass-card p-8">
                <div className="relative z-10 space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/30 backdrop-blur-sm rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">Dashboard</div>
                        <div className="text-xs text-gray-400">
                          Sincronización activa
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400">En vivo</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary/10 backdrop-blur-sm rounded-lg p-4 border border-primary/20">
                      <div className="text-2xl font-bold text-white">3</div>
                      <div className="text-xs text-gray-400">
                        Tiendas conectadas
                      </div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <div className="text-2xl font-bold text-white">500</div>
                      <div className="text-xs text-gray-400">
                        Productos sincronizados
                      </div>
                    </div>
                  </div>

                  {/* Activity List */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-400 mb-2">
                      Actividad Reciente
                    </div>
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <div className="flex-1 text-xs text-white">
                          Stock actualizado
                        </div>
                        <div className="text-xs text-gray-400">
                          {i}m
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Elements with Glass */}
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [-5, 5, -5],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -top-6 -right-6 glass-card-primary px-4 py-3 text-sm font-semibold text-white"
              >
                <span className="relative z-10">✓ 99.9% Precisión</span>
              </motion.div>

              <motion.div
                animate={{
                  y: [0, 10, 0],
                  rotate: [5, -5, 5],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                className="absolute -bottom-6 -left-6 glass-card px-4 py-3 text-sm font-semibold text-white"
              >
                <span className="relative z-10">⚡ Tiempo Real</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
