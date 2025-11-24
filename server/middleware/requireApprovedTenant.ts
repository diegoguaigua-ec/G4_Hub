import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    tenantId: number | null;
  };
}

export async function requireApprovedTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = (req as AuthenticatedRequest).user;

  // Skip check for admins (they can approve other tenants)
  if (user.role === "admin") {
    return next();
  }

  // Verify tenant has tenantId
  if (!user.tenantId) {
    return res.status(403).json({ message: "User has no tenant" });
  }

  // Get tenant and check account status
  const tenant = await storage.getTenant(user.tenantId);
  if (!tenant) {
    return res.status(404).json({ message: "Tenant not found" });
  }

  // Only allow access if account is approved
  if (tenant.accountStatus !== "approved") {
    return res.status(403).json({
      message: "Tu cuenta está pendiente de aprobación. Por favor espera a que un administrador apruebe tu cuenta.",
      accountStatus: tenant.accountStatus,
    });
  }

  next();
}
