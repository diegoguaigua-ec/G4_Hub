import { motion } from "framer-motion";

const platforms = [
  {
    name: "Shopify",
    textLogo: "Shopify",
    highlighted: false,
  },
  {
    name: "WooCommerce",
    textLogo: "WooCommerce",
    highlighted: false,
  },
  {
    name: "Contífico",
    textLogo: "CONTÍFICO",
    highlighted: true,
  },
  {
    name: "SAP",
    textLogo: "SAP",
    comingSoon: true,
  },
  {
    name: "Dátil",
    textLogo: "Dátil",
    comingSoon: true,
  },
  {
    name: "Servientrega",
    textLogo: "Servientrega",
    comingSoon: true,
  },
];

function LogoGroup() {
  return (
    <>
      {platforms.map((platform, index) => (
        <div
          key={`${platform.name}-${index}`}
          className="flex-shrink-0 flex items-center justify-center px-12"
        >
          <div className="relative">
            {/* Text-based logo placeholder */}
            <div
              className={`text-xl font-bold tracking-wider transition-all duration-300 ${
                platform.highlighted
                  ? "text-white opacity-100"
                  : "text-white/60 hover:text-white/95"
              }`}
            >
              {platform.textLogo}
            </div>

            {/* Badge for highlighted or coming soon */}
            {platform.highlighted && (
              <div className="absolute -top-2 -right-2">
                <div className="bg-primary text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Principal
                </div>
              </div>
            )}
            {platform.comingSoon && (
              <div className="absolute -top-2 -right-2">
                <div className="bg-white/10 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10">
                  Pronto
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export default function TrustBar() {
  return (
    <section className="py-16 bg-black overflow-hidden border-y border-white/5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center text-gray-400 uppercase tracking-wider mb-12"
          style={{ fontSize: '14px' }}
        >
          Integrado con las plataformas líderes del mercado
        </motion.p>

        {/* Infinite scroll container */}
        <div className="relative">
          {/* Enhanced gradient masks on sides - wider and smoother */}
          <div
            className="absolute left-0 top-0 bottom-0 w-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.8) 30%, rgba(0, 0, 0, 0) 100%)'
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.8) 30%, rgba(0, 0, 0, 0) 100%)'
            }}
          />

          {/* Scrolling track */}
          <div className="flex gap-0 animate-infinite-scroll">
            {/* First iteration */}
            <LogoGroup />
            {/* Second iteration (duplicated for seamless loop) */}
            <LogoGroup />
          </div>
        </div>

        {/* Additional note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-gray-400" style={{ fontSize: '14px' }}>
            + Más integraciones próximamente
          </p>
        </motion.div>
      </div>
    </section>
  );
}
