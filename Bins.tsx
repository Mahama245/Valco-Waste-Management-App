import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface RouteRow {
  id: number;
  route_code: string;
  name: string;
  collector_name: string | null;
  vehicle_reg: string | null;
  scheduled_date: string;
  estimated_distance_km: string | null;
  estimated_duration_min: number | null;
  status: string;
  total_stops: number;
  completed_stops: number;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "text-status-info border-status-info/30",
  IN_PROGRESS: "text-status-warning border-status-warning/30",
  COMPLETED: "text-status-success border-status-success/30",
  CANCELLED: "text-gray-500 border-graphite-600",
};

export default function Routes() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/routes").then((res) => setRoutes(res.data.routes)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Field Operations</p>
        <h1 className="font-display text-2xl font-semibold text-white">Smart Route Management</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm col-span-full">Loading routes...</p>
        ) : routes.length === 0 ? (
          <p className="text-gray-500 text-sm col-span-full">No routes planned yet.</p>
        ) : (
          routes.map((r) => {
            const pct = r.total_stops ? Math.round((r.completed_stops / r.total_stops) * 100) : 0;
            return (
              <Link
                key={r.id}
                to={`/routes/${r.id}`}
                className="bg-graphite-800 border border-graphite-700 hover:border-gold-500/40 rounded-sm p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-gold-500">{r.route_code}</span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-sm border ${STATUS_COLORS[r.status]}`}>
                    {r.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-white font-medium mb-1">{r.name}</p>
                <p className="text-xs text-gray-400 mb-3">
                  {r.collector_name || "Unassigned"} · {r.vehicle_reg || "No vehicle"}
                </p>

                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>{r.completed_stops} / {r.total_stops} stops</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-graphite-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <p className="text-[11px] text-gray-500">
                  {r.estimated_distance_km ? `${r.estimated_distance_km} km` : "—"} ·{" "}
                  {r.estimated_duration_min ? `${r.estimated_duration_min} min` : "—"}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
