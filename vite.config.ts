import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
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
  bin_id: number | null;
  scan_verified: boolean;
}
interface RouteDetailType {
  id: number;
  route_code: string;
  name: string;
  collector_name: string | null;
  vehicle_reg: string | null;
  status: string;
  estimated_distance_km: string | null;
  estimated_duration_min: number | null;
}
interface BinOption {
  id: number;
  bin_code: string;
  zone_name: string;
}

const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

export default function RouteDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [route, setRoute] = useState<RouteDetailType | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStopId, setBusyStopId] = useState<number | null>(null);
  const canManage = user && MANAGE_ROLES.includes(user.role);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/routes/${id}`).then((res) => {
      setRoute(res.data.route);
      setStops(res.data.stops);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (canManage) {
      api.get("/bins").then((res) => setBins(res.data.bins.map((b: any) => ({ id: b.id, bin_code: b.bin_code, zone_name: b.zone_name }))));
    }
  }, [canManage]);

  async function assignBin(stopId: number, binId: string) {
    setBusyStopId(stopId);
    try {
      await api.patch(`/routes/stops/${stopId}/bin`, { bin_id: binId ? Number(binId) : null });
      load();
    } finally {
      setBusyStopId(null);
    }
  }

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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-xs text-gray-400">{s.collection_code}</span>
                <StatusBadge status={s.status === "COMPLETED" ? "COMPLETED" : "PENDING"} />
                {s.status === "COMPLETED" && s.scan_verified && (
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-sm bg-status-successBg text-status-success">
                    ✓ QR Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-white">{s.location}</p>
              <p className="text-xs text-gray-500 mt-1">
                {s.zone_name} · {s.waste_type?.replace("_", " ")} · Priority: {s.priority} · {s.scheduled_time}
              </p>

              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">Assigned bin:</span>
                  <select
                    value={s.bin_id || ""}
                    disabled={busyStopId === s.id}
                    onChange={(e) => assignBin(s.id, e.target.value)}
                    className="bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1 text-xs text-gray-300 disabled:opacity-50"
                  >
                    <option value="">None (manual check-in)</option>
                    {bins.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bin_code} — {b.zone_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
