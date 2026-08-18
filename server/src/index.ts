import express from "express";
import cors from "cors";
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
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

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`VALCO Waste Management API running on port ${PORT}`);
});
