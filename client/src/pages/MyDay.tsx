import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { getQueue, isStopPending, queueStopCompletion, trySync } from "../offlineSync";

interface Stop {
  id: number;
  stop_order: number;
  status: string;
  collection_code: string;
  location: string;
  waste_type: string;
  priority: string;
  scheduled_time: string;
  zone_name: string;
}
interface RouteDetail {
  id: number;
  route_code: string;
  name: string;
  status: string;
}

export default function MyDay() {
  const { user } = useAuth();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    api
      .get("/routes", { params: { date: today } })
      .then(async (res) => {
        const myRoute = res.data.routes[0];
        if (!myRoute) {
          setRoute(null);
          setStops([]);
          return;
        }
        const detail = await api.get(`/routes/${myRoute.id}`);
        setRoute(detail.data.route);
        setStops(detail.data.stops);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const runSync = useCallback(async () => {
    if (getQueue().length === 0) return;
    setSyncing(true);
    const result = await trySync();
    setPendingCount(getQueue().length);
    setSyncing(false);
    if (result.synced > 0) load();
  }, [load]);

  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
      runSync();
    }
    function onOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => {
      if (navigator.onLine) runSync();
    }, 20000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [runSync]);

  async function checkIn(stop: Stop) {
    const nowIso = new Date().toISOString();

    // Optimistically update the UI immediately, whether online or not
    setStops((prev) => prev.map((s) => (s.id === stop.id ? { ...s, status: "COMPLETED" } : s)));

    if (navigator.onLine) {
      try {
        await api.patch(`/routes/stops/${stop.id}`, { status: "COMPLETED", arrived_at: nowIso });
        return;
      } catch {
        // fall through to offline queue if the request fails
      }
    }

    queueStopCompletion({ stop_id: stop.id, status: "COMPLETED", arrived_at_client: nowIso, route_id: route!.id });
    setPendingCount(getQueue().length);
  }

  const completed = stops.filter((s) => s.status === "COMPLETED").length;
  const nextStop = stops.find((s) => s.status !== "COMPLETED");

  return (
    <div className="max-w-md mx-auto space-y-4 pb-6">
      {/* connectivity banner */}
      {!isOnline && (
        <div className="bg-status-warningBg border border-status-warning/30 text-status-warning text-xs px-3 py-2 rounded-sm text-center">
          You're offline. Check-ins are saved on this device and will sync automatically.
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-status-infoBg border border-status-info/30 text-status-info text-xs px-3 py-2 rounded-sm text-center flex items-center justify-center gap-2">
          {syncing ? "Syncing..." : `${pendingCount} check-in${pendingCount > 1 ? "s" : ""} pending sync`}
          {!syncing && (
            <button onClick={runSync} className="underline">
              Retry now
            </button>
          )}
        </div>
      )}

      <div>
        <p className="text-sm text-gray-400">Good day,</p>
        <h1 className="font-display text-2xl font-semibold text-white">{user?.fullName.split(" ")[0]}</h1>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading your route...</p>
      ) : !route ? (
        <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-6 text-center">
          <p className="text-gray-400 text-sm">No route assigned to you today.</p>
        </div>
      ) : (
        <>
          <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Today's Progress</p>
            <p className="font-display text-3xl text-white mb-2">
              {completed} / {stops.length}
              <span className="text-sm text-gray-400 font-body ml-2">collections</span>
            </p>
            <div className="w-full h-2 bg-graphite-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-status-success"
                style={{ width: `${stops.length ? (completed / stops.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {nextStop && (
            <div className="bg-gold-500/10 border border-gold-500/30 rounded-sm p-4">
              <p className="text-[11px] uppercase tracking-wider text-gold-500 mb-2">Next Stop</p>
              <p className="text-white font-medium">{nextStop.location}</p>
              <p className="text-xs text-gray-400 mt-1">
                {nextStop.zone_name} · {nextStop.waste_type?.replace("_", " ")} · {nextStop.scheduled_time}
              </p>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(nextStop.location)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block w-full text-center text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold py-2.5 rounded-sm"
              >
                Start Navigation
              </a>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">All Stops</p>
            {stops.map((s) => {
              const pending = isStopPending(s.id);
              return (
                <div key={s.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-graphite-700 flex items-center justify-center text-[10px] font-mono text-gold-500 shrink-0">
                    {s.stop_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.location}</p>
                    <p className="text-[11px] text-gray-500">{s.scheduled_time} · {s.waste_type?.replace("_", " ")}</p>
                  </div>
                  {s.status === "COMPLETED" ? (
                    <span className={`text-[10px] uppercase px-2 py-1 rounded-sm shrink-0 ${pending ? "bg-status-warningBg text-status-warning" : "bg-status-successBg text-status-success"}`}>
                      {pending ? "Pending Sync" : "Done"}
                    </span>
                  ) : (
                    <button
                      onClick={() => checkIn(s)}
                      className="shrink-0 text-xs bg-graphite-700 hover:bg-graphite-600 text-gray-200 px-3 py-2 rounded-sm"
                    >
                      Check In
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
