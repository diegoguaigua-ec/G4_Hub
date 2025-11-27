import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if tenant account is pending (except for admins who can approve accounts)
  if (user.role !== "admin" && user.tenant?.accountStatus === "pending") {
    return (
      <Route path={path}>
        <Redirect to="/pending" />
      </Route>
    );
  }

  // Check if tenant account is rejected or suspended
  if (user.tenant?.accountStatus === "rejected" || user.tenant?.accountStatus === "suspended") {
    return (
      <Route path={path}>
        <Redirect to="/pending" />
      </Route>
    );
  }

  return <Component />
}
