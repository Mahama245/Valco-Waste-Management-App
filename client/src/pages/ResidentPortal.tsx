import { useEffect, useState } from "react";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

interface Complaint {
  id: number;
  tracking_number: string;
  category: string;
  location: string;
  description: string;
  status: string;
  response: string | null;
  created_at: string;
}

interface RecentCollection {
  id: number;
  collection_code: string;
  location: string;
  actual_pickup_time: string | null;
  waste_type: string;
  confirmation_id: number | null;
  rating: number | null;
  comment: string | null;
}

const CATEGORIES = [
  { value: "missed_collection", label: "Missed Collection" },
  { value: "overflowing_bin", label: "Overflowing Bin" },
  { value: "illegal_dumping", label: "Illegal Dumping" },
  { value: "damaged_bin", label: "Damaged Bin" },
  { value: "other", label: "Other" },
];

export default function ResidentPortal() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [recent, setRecent] = useState<RecentCollection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      api.get("/complaints"),
      api.get("/confirmations/recent-in-my-zone"),
    ])
      .then(([c, r]) => {
        setComplaints(c.data.complaints);
        setRecent(r.data.collections);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submitConfirmation(collectionId: number, rating: number) {
    await api.post("/confirmations", { collection_id: collectionId, rating });
    load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Resident Portal</p>
        <h1 className="font-display text-2xl font-semibold text-white">Waste Collection</h1>
      </div>

      <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Next Collection</p>
        <p className="font-display text-2xl text-white">Monday</p>
        <p className="text-sm text-gray-400">7:00 AM – 9:00 AM</p>
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-white mb-3">Confirm Recent Collections</h2>
          <div className="space-y-2">
            {recent.map((c) => (
              <div key={c.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-gold-500">{c.collection_code}</span>
                  <span className="text-[11px] text-gray-500">
                    {c.actual_pickup_time ? new Date(c.actual_pickup_time).toLocaleDateString() : "—"}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mb-2">{c.location} · {c.waste_type?.replace("_", " ")}</p>
                {c.confirmation_id ? (
                  <p className="text-xs text-status-success">
                    ✓ You confirmed this {c.rating ? `— rated ${c.rating}/5` : ""}
                  </p>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-gray-400 mr-1">Confirm & rate:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => submitConfirmation(c.id, n)}
                        className="text-lg text-gray-600 hover:text-gold-500 transition-colors"
                        title={`${n} star${n > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">My Reports</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-sm"
        >
          {showForm ? "Cancel" : "+ Report an Issue"}
        </button>
      </div>

      {showForm && <ReportForm onSubmitted={() => { setShowForm(false); load(); }} />}

      <div className="space-y-2">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : complaints.length === 0 ? (
          <p className="text-gray-500 text-sm">No reports submitted yet.</p>
        ) : (
          complaints.map((c) => (
            <div key={c.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-gold-500">{c.tracking_number}</span>
                <StatusBadge status={c.status === "SUBMITTED" ? "PENDING" : c.status === "IN_REVIEW" ? "IN_PROGRESS" : c.status} />
              </div>
              <p className="text-sm text-gray-200">{c.description}</p>
              {c.response && (
                <p className="text-xs text-status-success mt-2 border-l-2 border-status-success/40 pl-2">{c.response}</p>
              )}
              <p className="text-[11px] text-gray-500 mt-2">{new Date(c.created_at).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReportForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/complaints", { category, location, description });
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 space-y-3">
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">What's the issue?</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Where?</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          placeholder="e.g. Estate Housing A, Block 4"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Details</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
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
