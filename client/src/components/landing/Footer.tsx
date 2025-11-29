import { Box, Mail, Linkedin, Twitter, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const footerLinks = {
  producto: [
    { label: "Características", href: "#features" },
    { label: "Planes", href: "#pricing" },
    { label: "Integraciones", href: "#integrations" },
    { label: "Actualizaciones", href: "#", comingSoon: true },
  ],
  empresa: [
    { label: "Sobre Nosotros", href: "#", comingSoon: true },
    { label: "Blog", href: "#", comingSoon: true },
    { label: "Contacto", href: "mailto:contact@g4hub.com" },
    { label: "Careers", href: "#", comingSoon: true },
  ],
  recursos: [
    { label: "Documentación", href: "#", comingSoon: true },
    { label: "API Reference", href: "#", comingSoon: true },
    { label: "Status", href: "#", comingSoon: true },
    { label: "Soporte", href: "/auth" },
  ],
  legal: [
    { label: "Términos de Servicio", href: "#", comingSoon: true },
    { label: "Política de Privacidad", href: "#", comingSoon: true },
    { label: "Política de Cookies", href: "#", comingSoon: true },
  ],
};

const socialLinks = [
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
];

export default function Footer() {
  const scrollToSection = (href: string) => {
    if (href.startsWith("#")) {
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
    }
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    alert("Función de newsletter próximamente disponible");
  };

  return (
    <footer id="footer" className="bg-black border-t border-white/10 pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Newsletter Section */}
        <div className="mb-16 max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-3 text-white">
            Mantente Actualizado
          </h3>
          <p className="text-muted-foreground mb-6">
            Recibe actualizaciones y tips de automatización e-commerce directamente en tu bandeja de entrada
          </p>
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="tu@email.com"
              className="flex-1"
              required
            />
            <Button type="submit">
              <Mail className="mr-2 h-4 w-4" />
              Suscribirse
            </Button>
          </form>
        </div>

        {/* Footer Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Column 1: Producto */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Producto</h4>
            <ul className="space-y-3">
              {footerLinks.producto.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("#") ? (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                    >
                      {link.label}
                      {link.comingSoon && (
                        <span className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold px-2 py-0.5 rounded-full shadow-md">
                          Pronto
                        </span>
                      )}
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Empresa */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    {link.label}
                    {link.comingSoon && (
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded">
                        Pronto
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Recursos */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Recursos</h4>
            <ul className="space-y-3">
              {footerLinks.recursos.map((link) => (
                <li key={link.label}>
                  {link.href === "/auth" ? (
                    <Link href={link.href}>
                      <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </a>
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                    >
                      {link.label}
                      {link.comingSoon && (
                        <span className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold px-2 py-0.5 rounded-full shadow-md">
                          Pronto
                        </span>
                      )}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    {link.label}
                    {link.comingSoon && (
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded">
                        Pronto
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo and Copyright */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Box className="h-4 w-4 text-[hsl(207,11%,11%)]" />
                </div>
                <span className="font-semibold text-foreground">G4 Hub</span>
              </div>
              <div className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} G4 Hub. Todos los derechos reservados.
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            {/* Made in Ecuador */}
            <div className="text-sm text-muted-foreground">
              Hecho en Ecuador 🇪🇨 para Latinoamérica
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
