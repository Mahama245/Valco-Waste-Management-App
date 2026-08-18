import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

interface Stop {
  id: number;
  stop_order: number;
  status: string;
  collection_code: string;
  location: string;
  waste_type: string;
  priority: string;
  scheduled_time: string;
  collection_status: string;
  zone_name: string;
}
interface RouteDetail {
  id: number;
  route_code: string;
  name: string;
  collector_name: string | null;
  vehicle_reg: string | null;
  status: string;
  estimated_distance_km: string | null;
  estimated_duration_min: number | null;
}

export default function RouteDetailPage() {
  const { id } = useParams();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/routes/${id}`).then((res) => {
      setRoute(res.data.route);
      setStops(res.data.stops);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500 text-sm">Loading route...</p>;
  if (!route) return <p className="text-status-critical text-sm">Route not found.</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <Link to="/routes" className="text-xs text-gray-400 hover:text-gold-500">&larr; All routes</Link>

      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1 font-mono">{route.route_code}</p>
        <h1 className="font-display text-2xl font-semibold text-white">{route.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {route.collector_name || "Unassigned"} · {route.vehicle_reg || "No vehicle"} ·{" "}
          {route.estimated_distance_km ? `${route.estimated_distance_km} km` : "—"} ·{" "}
          {route.estimated_duration_min ? `${route.estimated_duration_min} min est.` : "—"}
        </p>
      </div>

      <ol className="space-y-3">
        {stops.map((s) => (
          <li key={s.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-graphite-700 flex items-center justify-center text-xs font-mono text-gold-500 shrink-0">
              {s.stop_order}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-gray-400">{s.collection_code}</span>
                <StatusBadge status={s.status === "COMPLETED" ? "COMPLETED" : "PENDING"} />
              </div>
              <p className="text-sm text-white">{s.location}</p>
              <p className="text-xs text-gray-500 mt-1">
                {s.zone_name} · {s.waste_type?.replace("_", " ")} · Priority: {s.priority} · {s.scheduled_time}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
