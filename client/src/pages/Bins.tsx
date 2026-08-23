import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Bin {
  id: number;
  bin_code: string;
  zone_id: number;
  zone_name: string;
  location: string;
  waste_type: string;
  capacity_liters: string;
  fill_level_pct: string;
  status: string;
  last_collected_at: string | null;
  next_scheduled_at: string | null;
}
interface Zone {
  id: number;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  NORMAL: "bg-status-success",
  NEAR_CAPACITY: "bg-status-warning",
  CRITICAL: "bg-status-critical",
  OUT_OF_SERVICE: "bg-gray-500",
};
const WASTE_TYPES = ["GENERAL", "PLASTIC", "PAPER", "METAL", "GLASS", "ORGANIC", "HAZARDOUS", "E_WASTE", "OTHER"];
const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "COLLECTOR"];
const EDIT_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

export default function Bins() {
  const { user } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const canManage = user && MANAGE_ROLES.includes(user.role);
  const canEdit = user && EDIT_ROLES.includes(user.role);

  function load() {
    setLoading(true);
    api
      .get("/bins", { params: statusFilter ? { status: statusFilter } : {} })
      .then((res) => setBins(res.data.bins))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);
  useEffect(() => {
    api.get("/zones").then((res) => setZones(res.data.zones));
  }, []);

  async function markCollected(id: number) {
    setBusyId(id);
    try {
      await api.patch(`/bins/${id}/collected`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteBin(id: number) {
    if (!confirm("Remove this collection point? This can't be undone.")) return;
    setBusyId(id);
    try {
      await api.delete(`/bins/${id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Couldn't remove this bin.");
    } finally {
      setBusyId(null);
    }
  }

  const critical = bins.filter((b) => b.status === "CRITICAL").length;
  const nearCapacity = bins.filter((b) => b.status === "NEAR_CAPACITY").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Infrastructure</p>
          <h1 className="font-display text-2xl font-semibold text-white">Smart Bin & Container Management</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-status-critical">{critical} critical</span>
          <span className="text-status-warning">{nearCapacity} near capacity</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-graphite-800 border border-graphite-600 rounded-sm px-3 py-1.5 text-sm text-white"
          >
            <option value="">All bins</option>
            <option value="NORMAL">Normal</option>
            <option value="NEAR_CAPACITY">Near Capacity</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <Link
            to="/bins/print-qr"
            className="text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-200 px-3 py-1.5 rounded-sm"
          >
            🖨 Print QR Codes
          </Link>
          {canEdit && (
            <button
              onClick={() => setShowAddForm((s) => !s)}
              className="text-xs bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-sm"
            >
              {showAddForm ? "Cancel" : "+ Add Location"}
            </button>
          )}
        </div>
      </div>

      {showAddForm && <BinForm zones={zones} onSaved={() => { setShowAddForm(false); load(); }} />}
      {editingBin && (
        <BinForm
          zones={zones}
          existing={editingBin}
          onSaved={() => { setEditingBin(null); load(); }}
          onCancel={() => setEditingBin(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm col-span-full">Loading bins...</p>
        ) : bins.length === 0 ? (
          <p className="text-gray-500 text-sm col-span-full">No collection points yet. Add your first one above.</p>
        ) : (
          bins.map((b) => {
            const fill = parseFloat(b.fill_level_pct);
            return (
              <div key={b.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs text-gold-500">{b.bin_code}</p>
                    <p className="text-sm text-gray-300">{b.location}</p>
                    <p className="text-[11px] text-gray-500">{b.zone_name}</p>
                  </div>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-sm text-white ${STATUS_COLORS[b.status]}`}>
                    {b.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Fill level</span>
                    <span>{fill}%</span>
                  </div>
                  <div className="w-full h-2 bg-graphite-900 rounded-full overflow-hidden">
                    <div className={`h-full ${STATUS_COLORS[b.status]}`} style={{ width: `${fill}%` }} />
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-1">{b.waste_type.replace("_", " ")}</p>
                <p className="text-[11px] text-gray-500">
                  Last collected: {b.last_collected_at ? new Date(b.last_collected_at).toLocaleDateString() : "—"}
                </p>

                {canManage && b.status !== "NORMAL" && (
                  <button
                    onClick={() => markCollected(b.id)}
                    disabled={busyId === b.id}
                    className="mt-3 w-full text-xs bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 border border-gold-500/30 rounded-sm py-1.5 disabled:opacity-50"
                  >
                    {busyId === b.id ? "Recording..." : "Mark as Collected"}
                  </button>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to={`/bins/print-qr?bin=${b.id}`}
                    className="text-xs text-center bg-graphite-700 hover:bg-graphite-600 text-gray-300 rounded-sm py-1.5"
                  >
                    🔲 QR Code
                  </Link>
                  {canEdit && (
                    <button
                      onClick={() => setEditingBin(b)}
                      className="text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-300 rounded-sm py-1.5"
                    >
                      ✎ Edit
                    </button>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => deleteBin(b.id)}
                    disabled={busyId === b.id}
                    className="mt-2 w-full text-xs text-status-critical/80 hover:text-status-critical disabled:opacity-50"
                  >
                    Remove this location
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BinForm({
  zones,
  existing,
  onSaved,
  onCancel,
}: {
  zones: Zone[];
  existing?: Bin;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [zoneId, setZoneId] = useState(existing?.zone_id?.toString() || "");
  const [location, setLocation] = useState(existing?.location || "");
  const [wasteType, setWasteType] = useState(existing?.waste_type || "GENERAL");
  const [capacity, setCapacity] = useState(existing?.capacity_liters || "1100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId || !location.trim()) {
      setError("Zone and location are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { zone_id: Number(zoneId), location: location.trim(), waste_type: wasteType, capacity_liters: Number(capacity) };
      if (existing) {
        await api.patch(`/bins/${existing.id}`, payload);
      } else {
        await api.post("/bins", payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't save this location.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 space-y-3">
      <p className="text-sm text-white font-medium">{existing ? `Edit ${existing.bin_code}` : "Add a new collection point"}</p>
      {error && <div className="text-status-critical text-xs">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Zone</span>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            <option value="">Select a zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Waste type</span>
          <select
            value={wasteType}
            onChange={(e) => setWasteType(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            {WASTE_TYPES.map((w) => (
              <option key={w} value={w}>{w.replace("_", " ")}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Location description</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          placeholder="e.g. Behind Workshop Block C, near loading bay"
        />
      </label>
      <label className="block w-40">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Capacity (liters)</span>
        <input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-sm bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
        >
          {submitting ? "Saving..." : existing ? "Save changes" : "Add location"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-4 py-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
