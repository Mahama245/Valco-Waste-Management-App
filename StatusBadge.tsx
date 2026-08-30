interface Props {
  label: string;
  value: string | number;
  accent?: "gold" | "success" | "warning" | "critical" | "info";
  suffix?: string;
}

const ACCENTS: Record<string, string> = {
  gold: "border-l-gold-500",
  success: "border-l-status-success",
  warning: "border-l-status-warning",
  critical: "border-l-status-critical",
  info: "border-l-status-info",
};

export default function KpiCard({ label, value, accent = "gold", suffix }: Props) {
  return (
    <div className={`bg-graphite-800 border border-graphite-700 border-l-[3px] ${ACCENTS[accent]} rounded-sm p-4`}>
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{label}</p>
      <p className="font-display text-3xl font-semibold text-white">
        {value}
        {suffix && <span className="text-base text-gray-400 ml-1 font-body">{suffix}</span>}
      </p>
    </div>
  );
}
