import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { Zap, ShieldCheck, Database } from "lucide-react";

interface Feature {
    icon: any;
    metric: string;
    label: string;
    description: string;
}

const features: Feature[] = [
    {
        icon: Database,
        metric: "15K+",
        label: "Infraestructura Masiva",
        description: "Capacidad probada para sincronizar catálogos extensos y múltiples tiendas simultáneamente sin degradación de rendimiento.",
    },
    {
        icon: ShieldCheck,
        metric: "99.9%",
        label: "Confiabilidad Absoluta",
        description: "Arquitectura redundante que garantiza la precisión de tu inventario y la disponibilidad del sistema 24/7.",
    },
    {
        icon: Zap,
        metric: "<15s",
        label: "Velocidad Instantánea",
        description: "Arquitectura basada en eventos (Webhooks) que actualiza tu stock en segundos, eliminando el riesgo de sobreventa.",
    },
];

export default function KeyFeaturesSection() {
    return (
        <section className="py-24 bg-black relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <AnimatedSection className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                        El Motor de tu Crecimiento
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                        Una infraestructura diseñada para escalar contigo, combinando potencia bruta con precisión quirúrgica.
                    </p>
                </AnimatedSection>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -5 }}
                            className="group relative bg-zinc-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:border-primary/30 transition-all duration-300"
                        >
                            <div className="flex flex-col h-full">
                                {/* Header with Icon and Metric */}
                                <div className="mb-6">
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                        <feature.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-2">
                                        {feature.metric}
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-200">
                                        {feature.label}
                                    </h3>
                                </div>

                                {/* Description */}
                                <div className="mt-auto">
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>

                            {/* Top border gradient on hover */}
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
