import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import zoneRoutes from "./routes/zones";
import collectionRoutes from "./routes/collections";
import dashboardRoutes from "./routes/dashboard";
import userRoutes from "./routes/users";
import auditRoutes from "./routes/audit";
import binRoutes from "./routes/bins";
import vehicleRoutes from "./routes/vehicles";
import incidentRoutes from "./routes/incidents";
import complaintRoutes from "./routes/complaints";
import notificationRoutes from "./routes/notifications";
import routeRoutes from "./routes/routes";
import reportRoutes from "./routes/reports";
import insightRoutes from "./routes/insights";
import confirmationRoutes from "./routes/confirmations";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());

// CORS: only trusted frontend origins may make authenticated requests.
// CLIENT_ORIGIN can be a single URL or a comma-separated list (e.g. local
// dev + production). Falls back to localhost dev origins if unset, so
// local development still works without extra config.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // no origin = same-origin/non-browser request (curl, server-to-server, health checks) — allow
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

// General API rate limiting (auth routes have their own stricter limiter)
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "VALCO Waste Management API" }));

app.use("/api/auth", authRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/bins", binRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/confirmations", confirmationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Global error handler — catches anything thrown or rejected that individual
// routes didn't handle themselves. Never leaks stack traces, SQL, file
// paths, or credentials to the client; logs the real detail server-side only.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = Math.random().toString(36).slice(2, 10);
  console.error(`[${requestId}]`, err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed.", requestId });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message || "Internal server error.",
    requestId,
  });
});

app.listen(PORT, () => {
  console.log(`VALCO Waste Management API running on port ${PORT}`);
});
