import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage, DatabaseStorage } from "./storage";
import { initDiscord, shutdownDiscord } from "./discord";
import { serverLogger } from "./lib/logger";

const app = express();
app.use(compression({
  filter: (req, res) => {
    if (req.path.includes('advance-story-stream')) return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      serverLogger.info({
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration,
      }, `${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Initialize database with sample data if needed
  if (storage instanceof DatabaseStorage) {
    try {
      await storage.initializeSampleData();
      log('Sample data initialization completed successfully');
      
      // Run migration to add narrative data to existing dungeon maps
      await storage.migrateDungeonMapsWithNarrative();
    } catch (error) {
      console.error('Error initializing sample data:', error);
    }
  }
  
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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize Discord bot in background (non-blocking, graceful failure)
    // Pass storage to enable slash command handling
    initDiscord(storage)
      .then((success: boolean) => {
        if (success) {
          log('Discord bot connected successfully');
        } else {
          log('Discord bot not available - integration optional');
        }
      })
      .catch((err: Error) => {
        log(`Discord initialization skipped: ${err.message}`);
      });
  });
  
  // Graceful shutdown handlers
  process.on('SIGTERM', async () => {
    log('Shutting down...');
    await shutdownDiscord();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    log('Shutting down...');
    await shutdownDiscord();
    process.exit(0);
  });
})();
