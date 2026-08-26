import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import StatusBadge from "../components/StatusBadge";

interface Collection {
  id: number;
  collection_code: string;
  zone_name: string;
  location: string;
  scheduled_date: string;
  scheduled_time: string;
  collector_name: string | null;
  vehicle_reg: string | null;
  waste_type: string;
  priority: string;
  status: string;
  quantity_collected_kg: string | null;
  missed_reason: string | null;
}

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"];
const CAN_MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "COLLECTOR"];

export default function Collections() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const canManage = user && CAN_MANAGE_ROLES.includes(user.role);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/collections", { params: statusFilter ? { status: statusFilter } : {} })
      .then((res) => setCollections(res.data.collections))
      .catch(() => setError("Couldn't load collections."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: number, status: string) {
    const body: any = { status };

    if (status === "COMPLETED") {
      const input = window.prompt("Enter the actual measured weight collected (kg):");
      if (input === null) return; // cancelled
      const kg = parseFloat(input);
      if (isNaN(kg) || kg < 0) {
        setError("Please enter a valid, non-negative weight in kg.");
        return;
      }
      body.quantity_collected_kg = Math.round(kg * 100) / 100;
      body.actual_pickup_time = new Date().toISOString();
    }
    if (status === "MISSED") {
      const reason = window.prompt("Reason this collection was missed:");
      if (reason === null) return; // cancelled
      body.missed_reason = reason.trim() || "No reason given";
    }

    setUpdatingId(id);
    try {
      await api.patch(`/collections/${id}/status`, body);
      load();
    } catch {
      setError("Couldn't update collection status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Operations</p>
          <h1 className="font-display text-2xl font-semibold text-white">Collection Management</h1>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Filter by status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-graphite-800 border border-graphite-600 rounded-sm px-3 py-1.5 text-sm text-white"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-status-critical text-sm">{error}</div>}

      <div className="bg-graphite-800 border border-graphite-700 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite-700 text-left text-[11px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Scheduled</th>
              <th className="px-4 py-3 font-medium">Collector</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Waste Type</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canManage && <th className="px-4 py-3 font-medium">Update</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  Loading collections...
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  No collections match this filter.
                </td>
              </tr>
            ) : (
              collections.map((c) => (
                <tr key={c.id} className="border-b border-graphite-700/60 last:border-0 hover:bg-graphite-700/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-gold-500">{c.collection_code}</td>
                  <td className="px-4 py-2.5 text-gray-200">{c.zone_name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {new Date(c.scheduled_date).toLocaleDateString()} {c.scheduled_time}
                  </td>
                  <td className="px-4 py-2.5 text-gray-200">{c.collector_name || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{c.vehicle_reg || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-300">{c.waste_type.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-gray-300">{c.priority}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5">
                      <select
                        value=""
                        disabled={updatingId === c.id}
                        onChange={(e) => e.target.value && updateStatus(c.id, e.target.value)}
                        className="bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1 text-xs text-gray-300 disabled:opacity-50"
                      >
                        <option value="">
                          {updatingId === c.id ? "Updating..." : "Change status"}
                        </option>
                        {STATUS_OPTIONS.filter((s) => s !== c.status).map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
