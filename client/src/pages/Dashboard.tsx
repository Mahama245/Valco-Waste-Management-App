import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "../api";
import KpiCard from "../components/KpiCard";

interface Summary {
  demo: boolean;
  kpis: {
    scheduled_today: number;
    completed_today: number;
    pending_today: number;
    missed_today: number;
    kg_collected_today: number;
    collection_efficiency_pct: number;
    critical_bin_alerts: number;
    near_capacity_bins: number;
    open_incidents: number;
    critical_incidents: number;
    active_vehicles: number;
    total_vehicles: number;
  };
  status_counts: { status: string; count: number }[];
  waste_composition: { waste_type: string; total_kg: string; count: number }[];
  zone_performance: { zone_name: string; completed: number; missed: number; total: number }[];
  recent_activity: { description: string; created_at: string }[];
}

const WASTE_COLORS: Record<string, string> = {
  GENERAL: "#4A535C",
  PLASTIC: "#5A9BD8",
  PAPER: "#C9A24B",
  METAL: "#8B8F94",
  GLASS: "#3FA34D",
  ORGANIC: "#7BAE4F",
  HAZARDOUS: "#E5555A",
  E_WASTE: "#B885D8",
  OTHER: "#6B7076",
};

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load dashboard data."));
  }, []);

  if (error) return <div className="text-status-critical">{error}</div>;
  if (!data) return <DashboardSkeleton />;

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Waste Operations</p>
          <h1 className="font-display text-2xl font-semibold text-white">Command Center</h1>
        </div>
        <span className="text-[11px] uppercase tracking-wider bg-gold-500/10 text-gold-500 border border-gold-500/30 px-2.5 py-1 rounded-sm">
          Demo Data
        </span>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Scheduled Today" value={kpis.scheduled_today} accent="info" />
        <KpiCard label="Completed Today" value={kpis.completed_today} accent="success" />
        <KpiCard label="Pending" value={kpis.pending_today} accent="gold" />
        <KpiCard label="Missed Today" value={kpis.missed_today} accent="critical" />
        <KpiCard label="Kg Collected Today" value={kpis.kg_collected_today.toLocaleString()} suffix="kg" accent="gold" />
        <KpiCard label="Collection Efficiency" value={kpis.collection_efficiency_pct} suffix="%" accent="success" />
      </div>

      {/* Fleet / bins / incidents row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Vehicles" value={`${kpis.active_vehicles} / ${kpis.total_vehicles}`} accent="info" />
        <KpiCard label="Critical Bin Alerts" value={kpis.critical_bin_alerts} accent="critical" />
        <KpiCard label="Near-Capacity Bins" value={kpis.near_capacity_bins} accent="warning" />
        <KpiCard label="Open Incidents" value={kpis.open_incidents} suffix={kpis.critical_incidents ? `(${kpis.critical_incidents} critical)` : undefined} accent={kpis.critical_incidents ? "critical" : "warning"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone performance */}
        <div className="lg:col-span-2 bg-graphite-800 border border-graphite-700 rounded-sm p-5">
          <h2 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">
            Collection Performance by Zone
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.zone_performance} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262B30" horizontal={false} />
              <XAxis type="number" stroke="#6B7076" fontSize={11} />
              <YAxis dataKey="zone_name" type="category" width={150} stroke="#6B7076" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="completed" stackId="a" fill="#3FA34D" name="Completed" />
              <Bar dataKey="missed" stackId="a" fill="#E5555A" name="Missed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Waste composition */}
        <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-5">
          <h2 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">Waste Composition</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.waste_composition}
                dataKey="total_kg"
                nameKey="waste_type"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.waste_composition.map((entry) => (
                  <Cell key={entry.waste_type} fill={WASTE_COLORS[entry.waste_type] || "#6B7076"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }}
                formatter={(value: number) => `${Number(value).toLocaleString()} kg`}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-5">
        <h2 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">Live Activity Stream</h2>
        <ul className="space-y-2">
          {data.recent_activity.map((a, i) => (
            <li key={i} className="flex items-start gap-3 text-sm border-b border-graphite-700/60 pb-2 last:border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0" />
              <span className="text-gray-300 flex-1">{a.description}</span>
              <span className="text-[11px] text-gray-500 font-mono shrink-0">
                {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-graphite-700 rounded-sm" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-graphite-800 border border-graphite-700 rounded-sm" />
        ))}
      </div>
      <div className="h-72 bg-graphite-800 border border-graphite-700 rounded-sm" />
    </div>
  );
}
