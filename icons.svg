import { useEffect, useState } from "react";
import { api } from "../api";

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-l-status-info",
  warning: "border-l-status-warning",
  critical: "border-l-status-critical",
};

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/insights")
      .then((res) => {
        setInsights(res.data.insights);
        setDisclaimer(res.data.disclaimer);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Analytics</p>
        <h1 className="font-display text-2xl font-semibold text-white">Smart Insights</h1>
      </div>

      <div className="bg-gold-500/5 border border-gold-500/20 rounded-sm px-4 py-3">
        <p className="text-xs text-gold-500/90">
          <strong>Recommendations, not predictions.</strong> {disclaimer}
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Analyzing historical data...</p>
      ) : insights.length === 0 ? (
        <p className="text-gray-500 text-sm">No notable patterns found in the current data.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((i) => (
            <div
              key={i.id}
              className={`bg-graphite-800 border border-graphite-700 border-l-[3px] ${SEVERITY_STYLES[i.severity]} rounded-sm p-4`}
            >
              <p className="text-sm text-white font-medium mb-1">{i.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{i.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
