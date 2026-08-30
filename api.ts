const STYLES: Record<string, string> = {
  COMPLETED: "bg-status-successBg text-status-success border-status-success/30",
  PENDING: "bg-status-infoBg text-status-info border-status-info/30",
  IN_PROGRESS: "bg-status-warningBg text-status-warning border-status-warning/30",
  MISSED: "bg-status-criticalBg text-status-critical border-status-critical/30",
  CANCELLED: "bg-graphite-700 text-gray-400 border-graphite-600",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || STYLES.CANCELLED;
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide rounded-sm border ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}
