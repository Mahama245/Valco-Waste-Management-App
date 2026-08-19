import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { api } from "../api";

type Tab = "collections" | "waste" | "collectors" | "vehicles" | "incidents" | "environmental";

const TABS: { key: Tab; label: string }[] = [
  { key: "collections", label: "Collections" },
  { key: "waste", label: "Waste" },
  { key: "collectors", label: "Collectors" },
  { key: "vehicles", label: "Vehicles" },
  { key: "incidents", label: "Incidents" },
  { key: "environmental", label: "Environmental" },
];

export default function Reports() {
  const [tab, setTab] = useState<Tab>("collections");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api
      .get(`/reports/${tab}`, { params })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [tab, dateFrom, dateTo]);

  function exportCsv() {
    const params = new URLSearchParams({ type: tab === "environmental" || tab === "collectors" || tab === "vehicles" ? "waste" : tab });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const token = localStorage.getItem("valco_token");
    const url = `${(api.defaults.baseURL || "")}/reports/export.csv?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${tab}_report.csv`;
        a.click();
      });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Analytics</p>
          <h1 className="font-display text-2xl font-semibold text-white">Reporting &amp; Analytics</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-graphite-800 border border-graphite-600 rounded-sm px-2 py-1.5 text-xs text-white"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-graphite-800 border border-graphite-600 rounded-sm px-2 py-1.5 text-xs text-white"
          />
          <button
            onClick={exportCsv}
            className="text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-200 px-3 py-1.5 rounded-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-200 px-3 py-1.5 rounded-sm"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-graphite-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.key ? "border-gold-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading report...</p>
      ) : (
        <>
          {tab === "collections" && data && <CollectionsReport data={data} />}
          {tab === "waste" && data && <WasteReport data={data} />}
          {tab === "collectors" && data && <CollectorsReport data={data} />}
          {tab === "vehicles" && data && <VehiclesReport data={data} />}
          {tab === "incidents" && data && <IncidentsReport data={data} />}
          {tab === "environmental" && data && <EnvironmentalReport data={data} />}
        </>
      )}
    </div>
  );
}

function ReportCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-5">{children}</div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="font-display text-2xl text-white">{value}</p>
    </div>
  );
}

function CollectionsReport({ data }: { data: any }) {
  return (
    <div className="space-y-5">
      <ReportCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Scheduled" value={data.summary.scheduled} />
          <Stat label="Completed" value={data.summary.completed} />
          <Stat label="Missed" value={data.summary.missed} />
          <Stat label="Efficiency" value={`${data.summary.efficiency_pct}%`} />
        </div>
      </ReportCard>
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">Daily Volume</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B30" />
            <XAxis dataKey="scheduled_date" stroke="#6B7076" fontSize={10} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <YAxis stroke="#6B7076" fontSize={11} />
            <Tooltip contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }} />
            <Bar dataKey="completed" fill="#3FA34D" name="Completed" />
            <Bar dataKey="missed" fill="#E5555A" name="Missed" />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function WasteReport({ data }: { data: any }) {
  return (
    <div className="space-y-5">
      <ReportCard>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total Collected" value={`${Math.round(data.total_kg).toLocaleString()} kg`} />
          <Stat label="Recycling Rate" value={`${data.recycling_rate_pct}%`} />
        </div>
      </ReportCard>
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">By Waste Type</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.by_type} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B30" horizontal={false} />
            <XAxis type="number" stroke="#6B7076" fontSize={11} />
            <YAxis dataKey="waste_type" type="category" width={90} stroke="#6B7076" fontSize={11} />
            <Tooltip contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }} formatter={(v: any) => `${Math.round(Mumber(v)).toLocaleString()} kg`} />
            <Bar dataKey="total_kg" fill="#C9A24B" />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">By Zone (Top 10)</h3>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {data.by_zone.slice(0, 10).map((z: any) => (
            <div key={z.zone_name} className="flex justify-between text-sm border-b border-graphite-700/60 py-1.5">
              <span className="text-gray-300">{z.zone_name}</span>
              <span className="text-gray-400 font-mono text-xs">{Math.round(z.total_kg).toLocaleString()} kg</span>
            </div>
          ))}
        </div>
      </ReportCard>
    </div>
  );
}

function CollectorsReport({ data }: { data: any }) {
  return (
    <ReportCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-graphite-700">
            <th className="py-2">Collector</th>
            <th className="py-2">Completed</th>
            <th className="py-2">Missed</th>
            <th className="py-2">Total Assigned</th>
            <th className="py-2">Punctuality</th>
          </tr>
        </thead>
        <tbody>
          {data.collectors.map((c: any) => (
            <tr key={c.id} className="border-b border-graphite-700/60 last:border-0">
              <td className="py-2 text-gray-200">{c.full_name}</td>
              <td className="py-2 text-status-success">{c.completed}</td>
              <td className="py-2 text-status-critical">{c.missed}</td>
              <td className="py-2 text-gray-400">{c.total_assigned}</td>
              <td className="py-2 text-gray-300">{c.punctuality_pct !== null ? `${c.punctuality_pct}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportCard>
  );
}

function VehiclesReport({ data }: { data: any }) {
  return (
    <ReportCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-graphite-700">
            <th className="py-2">Vehicle</th>
            <th className="py-2">Type</th>
            <th className="py-2">Trips</th>
            <th className="py-2">Completed</th>
            <th className="py-2">Mileage</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.map((v: any) => (
            <tr key={v.id} className="border-b border-graphite-700/60 last:border-0">
              <td className="py-2 font-mono text-xs text-gold-500">{v.registration_number}</td>
              <td className="py-2 text-gray-300">{v.vehicle_type}</td>
              <td className="py-2 text-gray-300">{v.trips}</td>
              <td className="py-2 text-status-success">{v.completed_trips}</td>
              <td className="py-2 text-gray-400">{v.mileage_km ? `${v.mileage_km} km` : "—"}</td>
              <td className="py-2 text-gray-300">{v.status?.replace("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportCard>
  );
}

function IncidentsReport({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">By Category</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.by_category} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B30" horizontal={false} />
            <XAxis type="number" stroke="#6B7076" fontSize={11} />
            <YAxis dataKey="category" type="category" width={110} stroke="#6B7076" fontSize={10} />
            <Tooltip contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }} />
            <Bar dataKey="count" fill="#5A9BD8" />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">By Severity</h3>
        <div className="space-y-2">
          {data.by_severity.map((s: any) => (
            <div key={s.severity} className="flex justify-between text-sm">
              <span className="text-gray-300">{s.severity}</span>
              <span className="font-mono text-gray-400">{s.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-graphite-700">
          Avg. resolution time: {data.avg_resolution_hours ? `${data.avg_resolution_hours} hrs` : "No resolved incidents yet"}
        </p>
      </ReportCard>
    </div>
  );
}

function EnvironmentalReport({ data }: { data: any }) {
  return (
    <div className="space-y-5">
      <ReportCard>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total Waste" value={`${Math.round(data.total_kg).toLocaleString()} kg`} />
          <Stat label="Recycling Rate" value={`${data.recycling_rate_pct}%`} />
          <Stat label="Landfill Diversion" value={`${data.landfill_diversion_rate_pct}%`} />
        </div>
      </ReportCard>
      <ReportCard>
        <h3 className="font-display text-sm uppercase tracking-wider text-gray-300 mb-4">Generation Trend</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.generation_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B30" />
            <XAxis dataKey="month" stroke="#6B7076" fontSize={11} />
            <YAxis stroke="#6B7076" fontSize={11} />
            <Tooltip contentStyle={{ background: "#1C2024", border: "1px solid #343B42", fontSize: 12 }} />
            <Line type="monotone" dataKey="total_kg" stroke="#C9A24B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}
