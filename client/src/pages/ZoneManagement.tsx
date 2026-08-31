import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface ZoneOverview {
  id: number;
  name: string;
  code: string;
  description: string | null;
  collector_id: number | null;
  collector_name: string | null;
  resident_count: number;
  collected_today: boolean;
}

interface Collector {
  id: number;
  full_name: string;
  is_active: boolean;
}

export default function ZoneManagement() {
  const [zones, setZones] = useState<ZoneOverview[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningZone, setAssigningZone] = useState<ZoneOverview | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.get("/zones/overview"), api.get("/users")])
      .then(([zonesRes, usersRes]) => {
        setZones(zonesRes.data.zones);
        setCollectors(
          usersRes.data.users.filter((u: any) => u.role === "COLLECTOR" && u.is_active)
        );
      })
      .catch(() => setError("Unable to load zones."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveAssignment(zoneId: number, collectorId: number | null) {
    try {
      await api.patch(`/zones/${zoneId}/collector`, { collector_id: collectorId });
      setBanner({ type: "success", text: "Collector assigned successfully." });
      setAssigningZone(null);
      load();
    } catch (err: any) {
      setBanner({ type: "error", text: err.response?.data?.error || "Unable to assign collector. Please try again." });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Administration</p>
          <h1 className="font-display text-2xl font-semibold text-white">Zone &amp; Collector Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            Each zone groups residents under a single operational area. Assign a collector to make them
            responsible for that zone's residents and collections.
          </p>
        </div>
        <Link
          to="/zones/print-qr"
          className="text-sm bg-graphite-800 hover:bg-graphite-700 border border-graphite-700 text-gray-200 font-medium px-4 py-2 rounded-sm shrink-0"
        >
          🖨 Print Zone QR Codes
        </Link>
      </div>

      {banner && (
        <div
          className={`text-sm px-3 py-2 rounded-sm border ${
            banner.type === "success"
              ? "bg-status-successBg text-status-success border-status-success/30"
              : "bg-status-criticalBg text-status-critical border-status-critical/40"
          }`}
        >
          {banner.text}
        </div>
      )}

      {!loading && zones.length > 0 && (
        <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 flex items-center gap-6 flex-wrap">
          {(() => {
            const assigned = zones.filter((z) => z.collector_id);
            const collected = assigned.filter((z) => z.collected_today).length;
            const notYet = assigned.length - collected;
            return (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">Collected Today</p>
                  <p className="font-display text-2xl text-status-success">{collected} / {assigned.length}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">Not Yet Collected</p>
                  <p className={`font-display text-2xl ${notYet > 0 ? "text-status-warning" : "text-gray-500"}`}>
                    {notYet}
                  </p>
                </div>
                <p className="text-xs text-gray-500 max-w-xs">
                  Reflects scans recorded so far today — updates live as collectors scan their zone QR codes.
                </p>
              </>
            );
          })()}
        </div>
      )}

      {error && <div className="text-status-critical text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading zones...</p>
      ) : zones.length === 0 ? (
        <p className="text-gray-500 text-sm">No zones available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {zones.map((z) => (
            <div key={z.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-xs text-gold-500">{z.code}</span>
                  <h2 className="font-display text-lg text-white">{z.name}</h2>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-sm border shrink-0 ${
                    z.collector_id
                      ? "bg-status-successBg text-status-success border-status-success/30"
                      : "bg-status-warningBg text-status-warning border-status-warning/30"
                  }`}
                >
                  {z.collector_id ? "Assigned" : "Unassigned"}
                </span>
              </div>

              <p className="text-sm text-gray-300 mb-1">
                Residents: <span className="text-white">{z.resident_count}</span>
              </p>
              <p className="text-sm text-gray-300 mb-1">
                Assigned Collector:{" "}
                <span className={z.collector_name ? "text-white" : "text-status-warning"}>
                  {z.collector_name || "UNASSIGNED"}
                </span>
              </p>
              {z.collector_id && (
                <p className="text-sm mb-4">
                  Today:{" "}
                  <span className={z.collected_today ? "text-status-success" : "text-status-warning"}>
                    {z.collected_today ? "✓ Collected" : "Not yet collected"}
                  </span>
                </p>
              )}
              {!z.collector_id && <div className="mb-4" />}

              <button
                onClick={() => setAssigningZone(z)}
                className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-sm"
              >
                {z.collector_id ? "Change Collector" : "Assign Collector"}
              </button>
            </div>
          ))}
        </div>
      )}

      {assigningZone && (
        <AssignCollectorModal
          zone={assigningZone}
          collectors={collectors}
          onCancel={() => setAssigningZone(null)}
          onSave={(collectorId) => saveAssignment(assigningZone.id, collectorId)}
        />
      )}
    </div>
  );
}

function AssignCollectorModal({
  zone,
  collectors,
  onCancel,
  onSave,
}: {
  zone: ZoneOverview;
  collectors: Collector[];
  onCancel: () => void;
  onSave: (collectorId: number | null) => void;
}) {
  const [selected, setSelected] = useState(zone.collector_id ? String(zone.collector_id) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(selected ? Number(selected) : null);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-5 w-full max-w-sm">
        <p className="text-sm text-white font-medium mb-1">Assign Collector</p>
        <p className="text-xs text-gray-400 mb-4">
          Zone: <span className="text-gray-200">{zone.code} — {zone.name}</span>
        </p>

        <label className="block mb-5">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Collector</span>
          {collectors.length === 0 ? (
            <p className="text-xs text-gray-500">No active collectors available.</p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
            >
              <option value="">— Select Collector —</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
        </label>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-400 hover:text-white px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selected}
            className="text-sm bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
          >
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
