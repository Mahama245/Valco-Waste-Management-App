import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Bin {
  id: number;
  bin_code: string;
  zone_name: string;
  location: string;
  waste_type: string;
  fill_level_pct: string;
  status: string;
  last_collected_at: string | null;
  next_scheduled_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  NORMAL: "bg-status-success",
  NEAR_CAPACITY: "bg-status-warning",
  CRITICAL: "bg-status-critical",
  OUT_OF_SERVICE: "bg-gray-500",
};

const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "COLLECTOR"];

export default function Bins() {
  const { user } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [qrBin, setQrBin] = useState<Bin | null>(null);
  const canManage = user && MANAGE_ROLES.includes(user.role);

  function load() {
    setLoading(true);
    api
      .get("/bins", { params: statusFilter ? { status: statusFilter } : {} })
      .then((res) => setBins(res.data.bins))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function markCollected(id: number) {
    setBusyId(id);
    try {
      await api.patch(`/bins/${id}/collected`);
      load();
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm col-span-full">Loading bins...</p>
        ) : (
          bins.map((b) => {
            const fill = parseFloat(b.fill_level_pct);
            return (
              <div key={b.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs text-gold-500">{b.bin_code}</p>
                    <p className="text-sm text-gray-300">{b.zone_name}</p>
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
                    <div
                      className={`h-full ${STATUS_COLORS[b.status]}`}
                      style={{ width: `${fill}%` }}
                    />
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

                <button
                  onClick={() => setQrBin(b)}
                  className="mt-2 w-full text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-300 rounded-sm py-1.5"
                >
                  🔲 Show QR Code
                </button>
              </div>
            );
          })
        )}
      </div>

      {qrBin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm p-6 w-full max-w-xs text-center print:shadow-none" id="bin-qr-print">
            <p className="font-display text-lg font-semibold text-graphite-950 mb-1">{qrBin.bin_code}</p>
            <p className="text-xs text-graphite-600 mb-4">{qrBin.zone_name}</p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={qrBin.bin_code} size={200} />
            </div>
            <p className="text-[11px] text-graphite-500 mb-4">
              Print and attach this to the physical bin. Collectors scan it to confirm pickup.
            </p>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold py-2 rounded-sm"
              >
                Print
              </button>
              <button
                onClick={() => setQrBin(null)}
                className="flex-1 text-sm bg-graphite-200 hover:bg-graphite-300 text-graphite-800 font-semibold py-2 rounded-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
