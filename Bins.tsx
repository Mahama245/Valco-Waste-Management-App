import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface AuditRow {
  id: number;
  action: string;
  record_type: string;
  record_id: number | null;
  description: string;
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-status-success",
  UPDATE: "text-status-warning",
  DELETE: "text-status-critical",
  LOGIN: "text-status-info",
};

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canDelete = user?.role === "SUPER_ADMIN";

  function load() {
    setLoading(true);
    api
      .get("/audit-logs")
      .then((res) => setLogs(res.data.audit_logs))
      .catch(() => setError("Couldn't load the audit log."))
      .finally(() => setLoading(false));
  }
 useEffect(() => {
  load(); // initial load
  const interval = setInterval(load, 5000);
  return () => clearInterval(interval);
}, []);

  async function deleteEntry(id: number) {
    if (!confirm("Delete this log entry permanently?")) return;
    setBusyId(id);
    try {
      await api.delete(`/audit-logs/${id}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    if (!confirm(`Delete ALL ${logs.length} audit log entries? This can't be undone.`)) return;
    if (!confirm("Really sure? This wipes the entire compliance history.")) return;
    setBusyId(-1);
    try {
      await api.delete("/audit-logs");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Compliance</p>
          <h1 className="font-display text-2xl font-semibold text-white">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">
            A record of actions taken across the platform.
            {canDelete && " As Super Admin you can delete individual entries or clear the log — each deletion is itself logged."}
          </p>
        </div>
        {canDelete && logs.length > 0 && (
          <button
            onClick={clearAll}
            disabled={busyId === -1}
            className="text-xs text-status-critical border border-status-critical/40 hover:bg-status-criticalBg px-3 py-1.5 rounded-sm disabled:opacity-50"
          >
            {busyId === -1 ? "Clearing..." : "Clear entire log"}
          </button>
        )}
      </div>

      {error && <div className="text-status-critical text-sm">{error}</div>}

      <div className="bg-graphite-800 border border-graphite-700 rounded-sm divide-y divide-graphite-700/60">
        {loading ? (
          <div className="px-4 py-10 text-center text-gray-500 text-sm">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-500 text-sm">No activity recorded yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 px-4 py-3">
              <span className={`text-[11px] font-mono uppercase w-16 shrink-0 ${ACTION_COLORS[log.action] || "text-gray-400"}`}>
                {log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{log.description}</p>
                {log.actor_name && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {log.actor_name} · {log.actor_role}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-gray-500 font-mono shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </span>
              {canDelete && (
                <button
                  onClick={() => deleteEntry(log.id)}
                  disabled={busyId === log.id}
                  className="text-[11px] text-gray-600 hover:text-status-critical shrink-0 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
