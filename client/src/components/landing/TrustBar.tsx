import { motion } from "framer-motion";

const platforms = [
  {
    name: "Shopify",
    logo: "/images/brands/shopify.png",
    highlighted: false,
    width: 120,
    height: 40,
  },
  {
    name: "WooCommerce",
    logo: "/images/brands/woocommerce.png",
    highlighted: false,
    width: 150,
    height: 40,
  },
  {
    name: "Contífico",
    logo: "/images/brands/contifico.png",
    highlighted: true,
    width: 140,
    height: 40,
  },
  {
    name: "SAP",
    logo: "/images/brands/sap.png",
    comingSoon: true,
    width: 80,
    height: 40,
  },
  {
    name: "Dátil",
    logo: "/images/brands/datil.png",
    comingSoon: true,
    width: 100,
    height: 40,
  },
  {
    name: "Servientrega",
    logo: "/images/brands/servientrega.png",
    comingSoon: true,
    width: 140,
    height: 40,
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
            {/* Logo image */}
            <img
              src={platform.logo}
              alt={platform.name}
              style={{
                width: `${platform.width}px`,
                height: `${platform.height}px`,
                objectFit: "contain",
              }}
              className={`transition-all duration-300 ${
                platform.highlighted
                  ? "opacity-100 brightness-100"
                  : "opacity-60 brightness-100 hover:opacity-95"
              }`}
            />

            {/* Badge for highlighted or coming soon */}
            {platform.highlighted && (
              <div className="absolute -top-2 -right-2">
                <div className="bg-[#D2FF3D]/90 backdrop-blur-sm border border-[#D2FF3D]/50 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-[#D2FF3D]/30">
                  Principal
                </div>
              </div>
            )}
            {platform.comingSoon && (
              <div className="absolute -top-2 -right-2">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md">
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

        {/* Carousel container with mask-image - Native CSS masking technique */}
        <div
          className="relative w-full overflow-hidden flex items-center justify-center py-2.5"
          style={{
            maskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 12.5%, rgb(0, 0, 0) 87.5%, rgba(0, 0, 0, 0) 100%)',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 12.5%, rgb(0, 0, 0) 87.5%, rgba(0, 0, 0, 0) 100%)'
          }}
        >
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
