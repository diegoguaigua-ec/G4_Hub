import { useEffect } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import ProductDemoSection from "@/components/landing/ProductDemoSection";
import KeyFeaturesSection from "@/components/landing/KeyFeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TrustBar from "@/components/landing/TrustBar";
import PricingSection from "@/components/landing/PricingSection";
import FinalCTASection from "@/components/landing/FinalCTASection";
import Footer from "@/components/landing/Footer";

/**
 * Landing Page Component
 * Shows marketing content to non-authenticated users
 * Redirects authenticated users to dashboard
 */
export default function LandingPage() {
  const { user, isLoading } = useAuth();

  // Set document title
  useEffect(() => {
    document.title = "G4 Hub - Automatización E-commerce para Latinoamérica";
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black dark flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect authenticated users to dashboard
  if (user) {
    return <Redirect to="/dashboard" />;
  }

  // Show landing page to non-authenticated users
  return (
    <div className="min-h-screen bg-black dark">
      <Header />
      <main>
        <HeroSection />
        <ProductDemoSection />
        <KeyFeaturesSection />
        <HowItWorksSection />
        <TrustBar />
        <PricingSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
