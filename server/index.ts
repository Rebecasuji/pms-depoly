import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { pool, checkDatabaseConnection } from "./db.ts";

const app = express();
const httpServer = createServer(app);

/* ===============================
   TYPES
================================ */
declare module "http" {
  interface IncomingMessage {
    rawBody?: unknown;
  }
}

/* ===============================
   MIDDLEWARE
================================ */
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

/* ===============================
   LOGGER
================================ */
export function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any;

  const originalJson = res.json.bind(res);

  res.json = ((body: any) => {
    capturedJsonResponse = body;
    return originalJson(body);
  }) as typeof res.json;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(
        `${req.method} ${path} ${res.statusCode} in ${duration}ms` +
          (capturedJsonResponse
            ? ` :: ${JSON.stringify(capturedJsonResponse)}`
            : "")
      );
    }
  });

  next();
});

/* ===============================
   BOOTSTRAP
================================ */
async function bootstrap() {
  /* ---------- DB HEALTH CHECK ---------- */
  console.log("📍 Starting database health check...");
  const isConnected = await checkDatabaseConnection();

  if (!isConnected) {
    console.warn(
      "⚠️  Warning: Database connection failed. Server will start but API calls may fail."
    );
    console.log(
      "💡 Please check your DATABASE_URL in .env and verify Neon is accessible."
    );
  } else {
    console.log("✨ Database is ready for queries.");
  }

  app.get("/db-test", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ success: true });
    } catch (err: any) {
      console.error("DB ERROR:", err.message);
      res.status(500).json({
        error: err.message,
        code: err.code,
      });
    }
  });

  /* ---------- REGISTER API ROUTES ---------- */
  await registerRoutes(httpServer, app);

  /* ---------- GLOBAL ERROR HANDLER ---------- */
  app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({
        message: err.message || "Internal Server Error",
      });
    }
  );

  /* ---------- FRONTEND (VITE / STATIC) ---------- */
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");

    app.use((req, _res, next) => {
      if (req.path.startsWith("/api")) return next();
      next();
    });

    await setupVite(httpServer, app);
  }

  /* ---------- START SERVER (ONE PORT ONLY) ---------- */
  const PORT = Number(process.env.PORT) || 5000;

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`Server running at http://localhost:${PORT}`);
  });
}

/* ===============================
   START
================================ */
bootstrap().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
