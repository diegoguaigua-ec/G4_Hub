import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { ShoppingBag, Store, Package, TrendingUp } from "lucide-react";

const platforms = [
  {
    name: "Shopify",
    icon: ShoppingBag,
    description: "E-commerce platform",
  },
  {
    name: "WooCommerce",
    icon: Store,
    description: "WordPress store",
  },
  {
    name: "Contífico",
    icon: Package,
    description: "ERP System",
    highlighted: true,
  },
  {
    name: "SAP",
    icon: TrendingUp,
    description: "Coming Soon",
    comingSoon: true,
  },
];

export default function TrustBar() {
  return (
    <section className="py-16 border-y bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Integrado con las plataformas líderes del mercado
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 items-center">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                whileHover={{ scale: 1.05 }}
                className={`group relative flex flex-col items-center justify-center p-6 rounded-lg transition-all ${
                  platform.highlighted
                    ? "bg-primary/10 border-2 border-primary/20"
                    : "hover:bg-muted/50"
                } ${platform.comingSoon ? "opacity-50" : ""}`}
              >
                <div
                  className={`w-16 h-16 flex items-center justify-center mb-3 rounded-lg transition-colors ${
                    platform.highlighted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <platform.icon className="w-8 h-8" />
                </div>

                <div className="text-center">
                  <div className="font-semibold text-foreground mb-1">
                    {platform.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {platform.description}
                  </div>
                </div>

                {platform.highlighted && (
                  <div className="absolute -top-2 -right-2">
                    <div className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
                      Principal
                    </div>
                  </div>
                )}

                {platform.comingSoon && (
                  <div className="absolute -top-2 -right-2">
                    <div className="bg-secondary text-secondary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
                      Próximamente
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Additional integrations coming soon note */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-muted-foreground">
              + Más integraciones próximamente: Dátil, Servientrega, y más
            </p>
          </motion.div>
        </AnimatedSection>
      </div>
    </section>
  );
}
