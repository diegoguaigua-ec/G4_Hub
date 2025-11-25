import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Zap, Check } from "lucide-react";

const benefits = [
  "Setup en 5 minutos",
  "Cancela cuando quieras",
  "Soporte en español",
];

export default function FinalCTASection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax effect for background elements
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <section
      ref={containerRef}
      className="relative py-20 lg:py-28 overflow-hidden"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-secondary -z-10" />

      {/* Parallax Decorative Elements */}
      <motion.div
        style={{ y: y1 }}
        className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"
      />
      <motion.div
        style={{ y: y2 }}
        className="absolute bottom-10 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl"
      />

      {/* Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-10 -z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Animated Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="space-y-8"
          >
            {/* Title */}
            <h2 className="text-4xl lg:text-5xl font-bold text-white">
              ¿Listo para Automatizar tu E-commerce?
            </h2>

            {/* Subtitle */}
            <p className="text-white/90 max-w-2xl mx-auto">
              Únete a cientos de negocios latinoamericanos que ya confían en G4 Hub
              para gestionar su inventario automáticamente
            </p>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <a href="https://cal.com/diego-guaigua-torres/30min" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="px-10 py-6 h-auto bg-white text-primary hover:bg-white/90 shadow-2xl"
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Agendar Demo
                </Button>
              </a>
            </motion.div>

            {/* Benefits List */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/90"
            >
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <Check className="h-5 w-5 text-white" />
                  <span>{benefit}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Trust Indicators (placeholder for logos) */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="pt-8 border-t border-white/20"
            >
              <p className="text-sm text-white/80 mb-4">
                Empresas de confianza en toda Latinoamérica
              </p>
              <div className="flex flex-wrap items-center justify-center gap-8 opacity-70">
                <div className="w-24 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">Ecuador</span>
                </div>
                <div className="w-24 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">Colombia</span>
                </div>
                <div className="w-24 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">México</span>
                </div>
                <div className="w-24 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">Perú</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-20 -z-10">
        <svg
          className="absolute bottom-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1200 120"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
            className="fill-background"
          />
          <path
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
            opacity=".5"
            className="fill-background"
          />
          <path
            d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
}
