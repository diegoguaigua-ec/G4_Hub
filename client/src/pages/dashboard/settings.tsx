import DashboardLayout from "../dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, CreditCard } from "lucide-react";
import AccountSection from "@/components/dashboard/settings/account-section";
import SecuritySection from "@/components/dashboard/settings/security-section";
import BillingSection from "@/components/dashboard/settings/billing-section";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configuración</h2>
          <p className="text-muted-foreground">
            Administra tu cuenta, seguridad y preferencias
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Cuenta</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Plan</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <AccountSection />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecuritySection />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingSection />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
