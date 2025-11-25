import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

type LoginData = { username: string; password: string; };
type RegisterData = { tenantName: string; subdomain: string; name: string; email: string; password: string; planType?: string; };

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // CRITICAL: Clear all cached data to prevent showing previous user's data
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], user);
      // Invalidate all queries to refetch with new user context
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      // Show user-friendly error messages
      const message = error.message.includes("pendiente de aprobación")
        ? "Tu cuenta está pendiente de aprobación. Recibirás un correo cuando sea aprobada."
        : error.message.includes("no disponible")
        ? "Tu cuenta no está disponible. Por favor contacta al administrador."
        : error.message.includes("incorrectas")
        ? "Credenciales incorrectas. Verifica tu email y contraseña."
        : error.message;

      toast({
        title: "Error al Iniciar Sesión",
        description: message,
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (data: any) => {
      // Check if registration requires approval
      if (data.requiresApproval) {
        toast({
          title: "¡Registro Exitoso!",
          description: data.message || "Tu cuenta está pendiente de aprobación. Recibirás un correo cuando sea aprobada.",
          duration: 8000,
        });
        // Don't set user data - account needs approval first
        return;
      }

      // If user is auto-logged in (legacy flow - shouldn't happen anymore)
      if (data.user) {
        queryClient.clear();
        queryClient.setQueryData(["/api/user"], data.user);
        queryClient.invalidateQueries();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error en el Registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // CRITICAL: Clear ALL cached queries to prevent showing logged-out user's data to next user
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
