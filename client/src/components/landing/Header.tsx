import { useState, useEffect } from "react";
import { Box, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Inicio", href: "#hero" },
  { label: "Características", href: "#features" },
  { label: "Beneficios", href: "#benefits" },
  { label: "Planes", href: "#pricing" },
  { label: "Contacto", href: "#footer" },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        const offset = 80; // Header height offset
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
      setMobileMenuOpen(false);
    }
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[hsl(207,11%,11%)]/95 backdrop-blur-md shadow-lg border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <button
            onClick={() => scrollToSection("#hero")}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
              <Box className="h-5 w-5 text-[hsl(207,11%,11%)]" />
            </div>
            <span className="text-xl font-bold text-white">G4 Hub</span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/auth">
              <Button variant="ghost" size="default">
                Iniciar Sesión
              </Button>
            </Link>
            <Link href="/auth?tab=register">
              <Button size="default" className="shadow-lg hover:shadow-xl transition-shadow">
                Comenzar Ahora
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col h-full">
                {/* Mobile Logo */}
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <Box className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="text-xl font-bold">G4 Hub</span>
                </div>

                {/* Mobile Navigation */}
                <nav className="flex flex-col gap-4 mb-8">
                  {navItems.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <button
                        onClick={() => scrollToSection(item.href)}
                        className="text-left text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                      >
                        {item.label}
                      </button>
                    </SheetClose>
                  ))}
                </nav>

                {/* Mobile CTAs */}
                <div className="mt-auto flex flex-col gap-3">
                  <SheetClose asChild>
                    <Link href="/auth">
                      <Button variant="outline" size="lg" className="w-full">
                        Iniciar Sesión
                      </Button>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/auth?tab=register">
                      <Button size="lg" className="w-full">
                        Comenzar Ahora
                      </Button>
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Progress bar on scroll (optional visual enhancement) */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary origin-left"
          />
        )}
      </AnimatePresence>
    </motion.header>
  );
}
