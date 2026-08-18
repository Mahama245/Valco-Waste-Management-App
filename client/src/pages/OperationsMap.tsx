import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../api";

// Fix default marker icon paths (Vite/Leaflet packaging quirk) — we use
// CircleMarker instead of the default pin icon, so this is just a safety net.
delete (L.Icon.Default.prototype as any)._getIconUrl;

interface Vehicle {
  id: number;
  registration_number: string;
  status: string;
  current_lat: string | null;
  current_lng: string | null;
  speed_kmh: string;
  driver_name: string | null;
}
interface Bin {
  id: number;
  bin_code: string;
  zone_name: string;
  lat: string | null;
  lng: string | null;
  fill_level_pct: string;
  status: string;
}
interface Incident {
  id: number;
  ticket_number: string;
  location: string;
  lat: string | null;
  lng: string | null;
  severity: string;
  status: string;
}

const VEHICLE_COLOR = "#5A9BD8";
const BIN_COLORS: Record<string, string> = { NORMAL: "#3FA34D", NEAR_CAPACITY: "#E8A93B", CRITICAL: "#E5555A", OUT_OF_SERVICE: "#6B7076" };
const INCIDENT_COLOR = "#E5555A";

const TEMA_CENTER: [number, number] = [5.669, 0.017];

export default function OperationsMap() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [layers, setLayers] = useState({ vehicles: true, bins: true, incidents: true });

  useEffect(() => {
    Promise.all([api.get("/vehicles"), api.get("/bins"), api.get("/incidents", { params: { status: "NEW" } })]).then(
      ([v, b, i]) => {
        setVehicles(v.data.vehicles);
        setBins(b.data.bins);
        setIncidents(i.data.incidents);
      }
    );
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Live Operations</p>
          <h1 className="font-display text-2xl font-semibold text-white">Operations Map</h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <LegendToggle
            color={VEHICLE_COLOR}
            label={`Vehicles (${vehicles.length})`}
            active={layers.vehicles}
            onClick={() => setLayers((l) => ({ ...l, vehicles: !l.vehicles }))}
          />
          <LegendToggle
            color="#E8A93B"
            label={`Bins (${bins.length})`}
            active={layers.bins}
            onClick={() => setLayers((l) => ({ ...l, bins: !l.bins }))}
          />
          <LegendToggle
            color={INCIDENT_COLOR}
            label={`Open Incidents (${incidents.length})`}
            active={layers.incidents}
            onClick={() => setLayers((l) => ({ ...l, incidents: !l.incidents }))}
          />
        </div>
      </div>

      <div className="bg-graphite-800 border border-graphite-700 rounded-sm overflow-hidden" style={{ height: 560 }}>
        <MapContainer center={TEMA_CENTER} zoom={13} style={{ height: "100%", width: "100%", background: "#15181B" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {layers.vehicles &&
            vehicles
              .filter((v) => v.current_lat && v.current_lng)
              .map((v) => (
                <CircleMarker
                  key={`v-${v.id}`}
                  center={[parseFloat(v.current_lat!), parseFloat(v.current_lng!)]}
                  radius={7}
                  pathOptions={{ color: VEHICLE_COLOR, fillColor: VEHICLE_COLOR, fillOpacity: 0.85, weight: 2 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>{v.registration_number}</strong>
                      <br />
                      Status: {v.status.replace("_", " ")}
                      <br />
                      Speed: {v.speed_kmh} km/h
                      <br />
                      Driver: {v.driver_name || "Unassigned"}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

          {layers.bins &&
            bins
              .filter((b) => b.lat && b.lng)
              .map((b) => (
                <CircleMarker
                  key={`b-${b.id}`}
                  center={[parseFloat(b.lat!), parseFloat(b.lng!)]}
                  radius={5}
                  pathOptions={{
                    color: BIN_COLORS[b.status] || "#6B7076",
                    fillColor: BIN_COLORS[b.status] || "#6B7076",
                    fillOpacity: 0.8,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>{b.bin_code}</strong>
                      <br />
                      {b.zone_name}
                      <br />
                      Fill: {b.fill_level_pct}% ({b.status.replace("_", " ")})
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

          {layers.incidents &&
            incidents
              .filter((i) => i.lat && i.lng)
              .map((i) => (
                <CircleMarker
                  key={`i-${i.id}`}
                  center={[parseFloat(i.lat!), parseFloat(i.lng!)]}
                  radius={9}
                  pathOptions={{ color: INCIDENT_COLOR, fillColor: INCIDENT_COLOR, fillOpacity: 0.3, weight: 2 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>{i.ticket_number}</strong>
                      <br />
                      {i.location}
                      <br />
                      Severity: {i.severity}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
        </MapContainer>
      </div>
      <p className="text-[11px] text-gray-500">
        Demo data — vehicle positions and sensor readings are simulated for this phase.
      </p>
    </div>
  );
}

function LegendToggle({ color, label, active, onClick }: { color: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-colors ${
        active ? "border-graphite-600 text-gray-200" : "border-graphite-700 text-gray-600"
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: active ? color : "#4A535C" }} />
      {label}
    </button>
  );
}
