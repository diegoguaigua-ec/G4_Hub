import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { ShoppingBag, Globe, Database, CreditCard, BarChart3, Truck, Layers, Box } from "lucide-react";

const AppIcon = ({ icon: Icon, color, label }: { icon: any, color: string, label?: string }) => (
    <div className="flex flex-col items-center gap-2">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-zinc-900 border border-white/10 hover:border-white/30 transition-colors shadow-lg group`}>
            <Icon className={`w-6 h-6 ${color} group-hover:scale-110 transition-transform`} />
        </div>
    </div>
);

export default function ProductDemoSection() {
    return (
        <section className="py-24 bg-black relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
                    {/* Visual Widget Copy (Left side on desktop usually, or right?) Konvex has text left, image right. Let's do Text Left. */}
                    <AnimatedSection className="text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6">
                            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span className="text-xs font-medium text-white/70">Embedded Integration</span>
                        </div>

                        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                            Todas tus integraciones en <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">un solo lugar</span>.
                        </h2>

                        <p className="text-gray-400 text-lg leading-relaxed mb-8">
                            Conecta Shopify, WooCommerce, Contífico y más herramientas operativas directamente desde G4 Hub. Un widget unificado para gestionar todo tu ecosistema.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {['Conexión en 1 click', 'Sincronización automática', 'Monitoreo en tiempo real'].map((item) => (
                                <li key={item} className="flex items-center gap-3 text-gray-300">
                                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </AnimatedSection>

                    {/* The Widget Visual */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="relative mx-auto lg:mr-0"
                    >
                        {/* Phone Frame */}
                        <div className="relative w-[320px] h-[640px] bg-black border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden ring-1 ring-white/5 z-10">

                            {/* Glowing Border specific to the request */}
                            <div className="absolute inset-0 border-[3px] border-cyan-500/50 rounded-[3rem] shadow-[0_0_40px_rgba(6,182,212,0.3)] pointer-events-none" />

                            {/* Top Notch Area */}
                            <div className="absolute top-0 left-0 right-0 h-16 flex justify-center items-end pb-2 bg-gradient-to-b from-black to-transparent z-20">
                                <div className="w-16 h-16 rounded-full border border-white/10 bg-zinc-900/80 backdrop-blur-md flex items-center justify-center mb-2 shadow-lg">
                                    <span className="text-[10px] uppercase font-bold text-gray-500">Logo</span>
                                </div>
                            </div>

                            {/* Screen Content */}
                            <div className="bg-gradient-to-b from-zinc-950 to-black h-full pt-20 px-6 pb-8 flex flex-col">
                                <h3 className="text-center text-white font-medium mb-8 text-sm tracking-wide">Select Integration</h3>

                                <div className="grid grid-cols-3 gap-4 mb-auto">
                                    {/* Row 1 */}
                                    <AppIcon icon={ShoppingBag} color="text-green-400" />
                                    <AppIcon icon={Globe} color="text-purple-400" />
                                    <AppIcon icon={Database} color="text-blue-400" />

                                    {/* Row 2 */}
                                    <AppIcon icon={CreditCard} color="text-yellow-400" />
                                    <AppIcon icon={BarChart3} color="text-pink-400" />
                                    <AppIcon icon={Truck} color="text-orange-400" />

                                    {/* Row 3 */}
                                    <AppIcon icon={Layers} color="text-cyan-400" />
                                    <AppIcon icon={Box} color="text-indigo-400" />
                                    <div className="flex flex-col items-center gap-2 opacity-50">
                                        <div className="w-14 h-14 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
                                            <span className="text-xl text-gray-600">+</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Button */}
                                <div className="mt-8 flex justify-center">
                                    <button className="px-6 py-2 rounded-full border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 transition-colors">
                                        View more
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Back Glow Effect */}
                        <div className="absolute -inset-4 bg-cyan-500/20 blur-3xl -z-10 rounded-[3rem]" />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
