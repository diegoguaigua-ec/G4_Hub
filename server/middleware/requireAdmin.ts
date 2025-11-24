import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

// Proper TypeScript interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user: User;
}

/**
 * Middleware to require admin role
 * Must be used after authentication middleware (passport.authenticate)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized - Not authenticated" });
  }

  const user = (req as AuthenticatedRequest).user;

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  next();
}
