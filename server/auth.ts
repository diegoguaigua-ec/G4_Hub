import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
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
    secret: process.env.SESSION_SECRET, // Validated at startup in server/index.ts
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

  app.post("/api/register", async (req, res, next) => {
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

      // Check if this is the first tenant (for initial admin)
      const allTenants = await storage.getAllTenants();
      const isFirstTenant = allTenants.length === 0;

      // Create tenant first (required for user creation)
      const apiKey = randomBytes(32).toString('hex');
      const tenant = await storage.createTenant({
        name: tenantName,
        subdomain,
        planType: selectedPlan,
        accountStatus: isFirstTenant ? "approved" : "pending", // First tenant auto-approved
        status: "active",
        settings: {},
        apiKey,
      });

      // Create user with tenant association (first tenant user is admin + owner)
      const user = await storage.createUser({
        tenantId: tenant.id,
        name,
        email,
        passwordHash: await hashPassword(password),
        role: isFirstTenant ? "admin" : "user", // First tenant user is admin
        emailVerified: false,
      });

      // First tenant gets auto-login, others need approval
      if (isFirstTenant) {
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json({ 
            user, 
            tenant,
            message: "Welcome! Your account has been created successfully.",
            isAdmin: true
          });
        });
      } else {
        res.status(201).json({ 
          message: "Registration successful. Your account is pending approval.",
          requiresApproval: true,
          tenant: {
            name: tenant.name,
            subdomain: tenant.subdomain,
            planType: tenant.planType,
          }
        });
      }
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ message: "Email or subdomain already exists" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
