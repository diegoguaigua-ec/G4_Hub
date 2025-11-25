import { ReactNode } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import { ExpirationBanner } from "@/components/expiration-banner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 p-8">
        <ExpirationBanner />
        {children}
      </main>
    </div>
  );
}