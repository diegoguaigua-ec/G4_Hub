// Load environment variables from .env file first
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { inventoryPushWorker } from "./workers/inventoryPushWorker";
import { runMigrations } from "./migrate";
import { initializeExpirationScheduler } from "./services/expirationNotifications";
import { apiLimiter } from "./middleware/rateLimiter";

// Validate critical environment variables before starting the app
function validateEnv() {
  const requiredVars = ['DATABASE_URL', 'SESSION_SECRET'] as const;
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ CRITICAL ERROR: Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    console.error('Example .env file:');
    console.error('  DATABASE_URL=postgresql://user:password@host:5432/database');
    console.error('  SESSION_SECRET=your-secret-key-min-32-characters');
    process.exit(1);
  }

  // Validate SESSION_SECRET length (should be at least 32 characters for security)
  if (process.env.SESSION_SECRET!.length < 32) {
    console.error('❌ CRITICAL ERROR: SESSION_SECRET must be at least 32 characters long');
    console.error('Current length:', process.env.SESSION_SECRET!.length);
    process.exit(1);
  }

  log('✓ Environment variables validated successfully');
}

// Validate environment before doing anything else
validateEnv();

const app = express();

// Capture raw body for webhook signature validation
app.use(
  "/api/webhooks",
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply rate limiting to all API routes (except health checks which are skipped in the limiter)
app.use('/api', apiLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // reusePort is not supported on Windows, only use it on Linux/Mac
  const isWindows = process.platform === 'win32';

  server.listen({
    port,
    host: "0.0.0.0",
    ...(isWindows ? {} : { reusePort: true }), // Only enable reusePort on Linux/Mac
  }, async () => {
    log(`✓ Server is ready and listening on port ${port}`);
    log(`✓ Health check available at http://0.0.0.0:${port}/health`);

    // Run migrations AFTER server starts to avoid blocking health checks
    // This ensures the server responds to health checks immediately
    log('Running database migrations...');
    try {
      await runMigrations();
      log('✓ Database migrations completed successfully');
    } catch (error) {
      console.error('❌ Error running migrations:', error);
      // Don't exit - allow the server to continue running
      // Some endpoints may still work even if migrations fail
    }

    // Background workers are only compatible with Reserved VM deployments
    // For Autoscale deployments, set ENABLE_BACKGROUND_WORKERS=false or remove the env var
    // For Reserved VM deployments, set ENABLE_BACKGROUND_WORKERS=true
    const enableBackgroundWorkers = process.env.NODE_ENV === 'development'
      || process.env.ENABLE_BACKGROUND_WORKERS === 'true';

    if (enableBackgroundWorkers) {
      // Start scheduler for automated syncs
      scheduler.start();
      log('✓ Scheduler started for automated syncs');

      // Start inventory push worker
      inventoryPushWorker.start();
      log('✓ Inventory push worker started');

      // Start expiration check scheduler
      initializeExpirationScheduler();
      log('✓ Account expiration scheduler started');
    } else {
      log('✓ Background workers disabled (Autoscale mode). Set ENABLE_BACKGROUND_WORKERS=true for Reserved VM deployments.');
    }
  });
})();
