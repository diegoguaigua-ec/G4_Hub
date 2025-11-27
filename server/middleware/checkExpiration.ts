import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user?: User & {
    tenant?: {
      id: number;
      expiresAt?: Date | null;
      accountStatus?: string;
    };
  };
}

/**
 * Middleware to check if tenant account has expired
 * Blocks write operations for expired accounts
 * Allows read operations (viewing logs, dashboards, history)
 */
export function checkExpiration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Skip if no user (will be caught by authentication middleware)
  if (!req.user) {
    return next();
  }

  // Skip check for admins
  if (req.user.role === "admin") {
    return next();
  }

  // Skip if no tenant info
  if (!req.user.tenant) {
    return next();
  }

  const tenant = req.user.tenant;

  // Skip if no expiration date set
  if (!tenant.expiresAt) {
    return next();
  }

  const now = new Date();
  const expiresAt = new Date(tenant.expiresAt);

  // Check if account has expired
  if (expiresAt < now) {
    // Account is expired - block write operations
    // Allow GET requests (reading logs, viewing history)
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      return res.status(403).json({
        error: "account_expired",
        message: "Tu cuenta ha expirado. Los servicios están suspendidos. Contacta con nosotros para reactivar tu cuenta.",
        expiresAt: expiresAt.toISOString(),
      });
    }
  }

  next();
}

/**
 * Strict expiration middleware for sensitive operations
 * Blocks ALL operations (including reads) for expired accounts
 * Use this for creating integrations, modifying settings, etc.
 */
export function strictCheckExpiration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return next();
  }

  // Skip check for admins
  if (req.user.role === "admin") {
    return next();
  }

  if (!req.user.tenant) {
    return next();
  }

  const tenant = req.user.tenant;

  if (!tenant.expiresAt) {
    return next();
  }

  const now = new Date();
  const expiresAt = new Date(tenant.expiresAt);

  if (expiresAt < now) {
    return res.status(403).json({
      error: "account_expired",
      message: "Tu cuenta ha expirado. Esta acción no está disponible. Contacta con nosotros para reactivar tu cuenta.",
      expiresAt: expiresAt.toISOString(),
    });
  }

  next();
}
