import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Box } from "lucide-react";
import { useMemo } from "react";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Parse query params to determine default tab
  const defaultTab = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const tab = params.get("tab");
    return tab === "register" ? "register" : "login";
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen login-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Hero Section */}
        <div className="text-white space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Box className="h-6 w-6 text-secondary" />
            </div>
            <span className="text-3xl font-bold">G4 Hub</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-tight">
              Automatización E-commerce
              <span className="block text-primary">Hecha Simple</span>
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Conecta tus tiendas en línea con sistemas ERP y automatiza todo tu flujo post-venta.
              Sincronización de inventario, facturación automatizada y gestión logística - todo en una plataforma.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">Súper Rápido</h3>
              <p className="text-gray-400 text-sm">Sincronización en tiempo real en todas las plataformas</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">Confiable</h3>
              <p className="text-gray-400 text-sm">99.9% de disponibilidad con seguridad empresarial</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">Escalable</h3>
              <p className="text-gray-400 text-sm">Crece con tu negocio desde startup hasta empresa</p>
            </div>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="w-full max-w-md mx-auto">
          <Card className="shadow-2xl border-0">
            <CardContent className="p-8">
              <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" data-testid="tab-login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Comenzar</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Bienvenido de nuevo</h2>
                    <p className="text-muted-foreground">Inicia sesión en tu plataforma de automatización</p>
                  </div>
                  <LoginForm />
                </TabsContent>
                <TabsContent value="register" className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Crea tu cuenta</h2>
                    <p className="text-muted-foreground">Comienza a automatizar tu e-commerce hoy</p>
                  </div>
                  <RegisterForm />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
