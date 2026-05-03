import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { StorageCleanup } from "./services/storage-cleanup";

const app = express();

// Trust proxy - required for rate limiting behind Replit's proxy
app.set('trust proxy', true);

// Increase timeout for large file uploads (15 minutes)
app.use((req, res, next) => {
  req.setTimeout(900000); // 15 minutes
  res.setTimeout(900000); // 15 minutes
  next();
});

app.use(express.json({ limit: '700mb' }));
app.use(express.urlencoded({ extended: false, limit: '700mb' }));

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
  // Validate required API keys in production
  const requiredKeys = ['OPENAI_API_KEY', 'RUNWAY_API_KEY'];
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  if (missingKeys.length > 0) {
    console.error(`[STARTUP ERROR] Missing required API keys: ${missingKeys.join(', ')}`);
    console.error('[STARTUP ERROR] Add these keys to Replit Secrets before deploying');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  } else {
    console.log('[STARTUP] ✓ All required API keys validated');
  }

  // Initialize automatic storage cleanup (runs every 30 minutes)
  StorageCleanup.schedulePeriodicCleanup(30);

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();