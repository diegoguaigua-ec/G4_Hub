import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { authLimiter } from "./middleware/rateLimiter";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!, // Validated at startup in server/index.ts
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.passwordHash))) {
        return done(null, false);
      }

      // Check tenant account status (except for admins)
      if (user.tenantId && user.role !== "admin") {
        const tenant = await storage.getTenant(user.tenantId);
        if (!tenant) {
          return done(null, false);
        }

        if (tenant.accountStatus !== "approved") {
          return done(null, false, {
            message: `Tu cuenta está ${tenant.accountStatus === "pending" ? "pendiente de aprobación" : "no disponible"}. Por favor contacta al administrador.`
          });
        }
      }

      await storage.updateUserLastLogin(user.id);
      return done(null, user);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      const { tenantName, subdomain, name, email, password, planType } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      // Validate tenant information (required - all users must belong to a tenant)
      if (!tenantName || !subdomain) {
        return res.status(400).json({
          message: "Tenant name and subdomain are required. All users must belong to a tenant."
        });
      }

      // Validate plan type
      const validPlanTypes = ["starter", "professional", "enterprise"];
      const selectedPlan = planType && validPlanTypes.includes(planType) ? planType : "starter";

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Check if subdomain already exists
      const existingTenant = await storage.getTenantBySubdomain(subdomain);
      if (existingTenant) {
        return res.status(400).json({ message: "Subdomain already exists" });
      }

      // All tenants start as "pending" - superadmin must be created manually in DB
      const apiKey = randomBytes(32).toString('hex');
      const tenant = await storage.createTenant({
        name: tenantName,
        subdomain,
        planType: selectedPlan,
        accountStatus: "pending", // All accounts require admin approval
        status: "active",
        settings: {},
        apiKey,
      });

      // Create user with tenant association - all start as regular users
      const user = await storage.createUser({
        tenantId: tenant.id,
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "user", // All users start as regular users
        emailVerified: false,
      });

      // All registrations return success message with pending status
      res.status(201).json({
        message: "¡Registro exitoso! Tu cuenta está pendiente de aprobación. Recibirás un correo cuando sea aprobada.",
        requiresApproval: true,
        tenant: {
          name: tenant.name,
          subdomain: tenant.subdomain,
          planType: tenant.planType,
        },
        user: {
          name: user.name,
          email: user.email,
        }
      });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ message: "Email or subdomain already exists" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", authLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        // If info has a message, it's likely about account status
        if (info && info.message) {
          return res.status(403).json({ message: info.message });
        }
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }

      req.logIn(user, async (err) => {
        if (err) {
          return next(err);
        }

        // Include tenant information with the user
        if (user && user.tenantId) {
          const tenant = await storage.getTenant(user.tenantId);
          return res.status(200).json({
            ...user,
            tenant: tenant || null,
          });
        }

        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user;

    // Include tenant information with the user
    if (user && user.tenantId) {
      const tenant = await storage.getTenant(user.tenantId);
      return res.json({
        ...user,
        tenant: tenant || null,
      });
    }

    res.json(user);
  });
}
