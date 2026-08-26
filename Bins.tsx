import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Incident {
  id: number;
  ticket_number: string;
  location: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  zone_name: string | null;
  reporter_name: string | null;
  officer_name: string | null;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "text-gray-400 border-graphite-600",
  MEDIUM: "text-status-info border-status-info/30",
  HIGH: "text-status-warning border-status-warning/30",
  CRITICAL: "text-status-critical border-status-critical/30",
};

const STATUS_FLOW = ["NEW", "ASSIGNED", "INVESTIGATING", "RESOLVED", "CLOSED"];
const TRIAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "HSE_OFFICER"];
const CATEGORIES = [
  "OVERFLOWING_BIN", "MISSED_COLLECTION", "ILLEGAL_DUMPING", "DAMAGED_BIN", "HAZARDOUS_WASTE",
  "WASTE_SPILL", "BLOCKED_ACCESS", "VEHICLE_BREAKDOWN", "WORKER_SAFETY", "ENVIRONMENTAL", "OTHER",
];

export default function Incidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canTriage = user && TRIAGE_ROLES.includes(user.role);

  function load() {
    setLoading(true);
    api
      .get("/incidents", { params: statusFilter ? { status: statusFilter } : {} })
      .then((res) => setIncidents(res.data.incidents))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function advanceStatus(id: number, current: string) {
    const idx = STATUS_FLOW.indexOf(current);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    setBusyId(id);
    try {
      await api.patch(`/incidents/${id}`, { status: next });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Compliance & Safety</p>
          <h1 className="font-display text-2xl font-semibold text-white">Incident Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-graphite-800 border border-graphite-600 rounded-sm px-3 py-1.5 text-sm text-white"
          >
            <option value="">All statuses</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-sm"
          >
            {showForm ? "Cancel" : "+ Report Incident"}
          </button>
        </div>
      </div>

      {showForm && <ReportForm onCreated={() => { setShowForm(false); load(); }} />}

      <div className="space-y-2">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading incidents...</p>
        ) : incidents.length === 0 ? (
          <p className="text-gray-500 text-sm">No incidents match this filter.</p>
        ) : (
          incidents.map((i) => (
            <div key={i.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gold-500">{i.ticket_number}</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-sm border ${SEVERITY_COLORS[i.severity]}`}>
                      {i.severity}
                    </span>
                    <span className="text-[10px] uppercase text-gray-400">{i.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-gray-200 font-medium">{i.category.replace(/_/g, " ")} — {i.location}</p>
                  <p className="text-xs text-gray-400 mt-1">{i.description}</p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Reported by {i.reporter_name || "Unknown"}
                    {i.officer_name && <> · Assigned to {i.officer_name}</>}
                    {" · "}
                    {new Date(i.created_at).toLocaleDateString()}
                  </p>
                </div>
                {canTriage && i.status !== "CLOSED" && (
                  <button
                    onClick={() => advanceStatus(i.id, i.status)}
                    disabled={busyId === i.id}
                    className="shrink-0 text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-200 px-3 py-1.5 rounded-sm disabled:opacity-50"
                  >
                    {busyId === i.id ? "Working..." : `Move to ${STATUS_FLOW[STATUS_FLOW.indexOf(i.status) + 1]}`}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReportForm({ onCreated }: { onCreated: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [severity, setSeverity] = useState("MEDIUM");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim() || !description.trim()) {
      setError("Location and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/incidents", { category, severity, location, description });
      onCreated();
    } catch {
      setError("Couldn't submit the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 space-y-3">
      {error && <div className="text-status-critical text-xs">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          placeholder="e.g. Near Potroom 2, bin cluster"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          placeholder="Describe what you observed."
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="text-sm bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
      >
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
