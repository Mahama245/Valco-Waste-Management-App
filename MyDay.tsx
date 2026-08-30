import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Vehicle {
  id: number;
  registration_number: string;
  vehicle_type: string;
  status: string;
  fuel_type: string | null;
  mileage_km: string | null;
  maintenance_due: string | null;
  insurance_expiry: string | null;
  roadworthy_expiry: string | null;
  speed_kmh: string;
  trip_distance_km: string;
  last_gps_update: string | null;
}
interface RouteInfo {
  id: number;
  route_code: string;
  name: string;
  collector_name: string | null;
  status: string;
}
interface Stop {
  id: number;
  stop_order: number;
  status: string;
  location: string;
  zone_name: string;
  scheduled_time: string;
}

export default function DriverToday() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/routes/my-vehicle-today")
      .then((res) => {
        setVehicle(res.data.vehicle);
        setRoute(res.data.route);
        setStops(res.data.stops);
      })
      .finally(() => setLoading(false));
  }, []);

  const maintenanceSoon =
    vehicle?.maintenance_due && new Date(vehicle.maintenance_due) <= new Date(Date.now() + 7 * 86400000);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-6">
      <div>
        <p className="text-sm text-gray-400">Good day,</p>
        <h1 className="font-display text-2xl font-semibold text-white">{user?.fullName.split(" ")[0]}</h1>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading your vehicle...</p>
      ) : !vehicle ? (
        <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-6 text-center">
          <p className="text-gray-400 text-sm">No vehicle currently assigned to you.</p>
          <p className="text-xs text-gray-500 mt-1">Contact your supervisor if this seems wrong.</p>
        </div>
      ) : (
        <>
          <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-lg text-gold-500">{vehicle.registration_number}</p>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-sm bg-status-infoBg text-status-info">
                {vehicle.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{vehicle.vehicle_type} · {vehicle.fuel_type || "—"}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Mileage</p>
                <p className="text-gray-200">{vehicle.mileage_km ? `${vehicle.mileage_km} km` : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Today's trip distance</p>
                <p className="text-gray-200">{vehicle.trip_distance_km} km</p>
              </div>
            </div>
          </div>

          {maintenanceSoon && (
            <div className="bg-status-warningBg border border-status-warning/30 text-status-warning text-xs px-3 py-2 rounded-sm">
              ⚠ Maintenance due {new Date(vehicle.maintenance_due!).toLocaleDateString()} — flag this to your
              supervisor before your next long route.
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Today's Route</p>
            {!route ? (
              <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 text-center">
                <p className="text-gray-400 text-sm">No route scheduled on this vehicle today.</p>
              </div>
            ) : (
              <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4">
                <p className="font-mono text-xs text-gold-500 mb-1">{route.route_code}</p>
                <p className="text-sm text-white mb-1">{route.name}</p>
                <p className="text-xs text-gray-500">Collector: {route.collector_name || "Unassigned"}</p>
              </div>
            )}
          </div>

          {stops.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Stops</p>
              {stops.map((s) => (
                <div key={s.id} className="bg-graphite-800 border border-graphite-700 rounded-sm p-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-graphite-700 flex items-center justify-center text-[10px] font-mono text-gold-500 shrink-0">
                    {s.stop_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.location}</p>
                    <p className="text-[11px] text-gray-500">{s.zone_name} · {s.scheduled_time}</p>
                  </div>
                  <span
                    className={`text-[10px] uppercase px-2 py-1 rounded-sm shrink-0 ${
                      s.status === "COMPLETED" ? "bg-status-successBg text-status-success" : "bg-graphite-700 text-gray-400"
                    }`}
                  >
                    {s.status === "COMPLETED" ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
