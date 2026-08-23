import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api";

interface Bin {
  id: number;
  bin_code: string;
  zone_name: string;
  location: string;
}
interface Zone {
  id: number;
  name: string;
}

export default function PrintQrCodes() {
  const [params] = useSearchParams();
  const singleBinId = params.get("bin");

  const [bins, setBins] = useState<Bin[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneFilter, setZoneFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/bins"), api.get("/zones")]).then(([b, z]) => {
      setBins(b.data.bins);
      setZones(z.data.zones);
      setLoading(false);
    });
  }, []);

  const visible = bins.filter((b) => {
    if (singleBinId) return b.id === Number(singleBinId);
    if (zoneFilter) return String(b.id) && zones.find((z) => z.id === Number(zoneFilter))?.name === b.zone_name;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Infrastructure</p>
          <h1 className="font-display text-2xl font-semibold text-white">Print QR Codes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Each QR code encodes that bin's unique code. Print, cut out, and attach to the physical bin — collectors
            scan it to confirm pickup, and it's checked against whichever bin was assigned to that stop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!singleBinId && (
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-graphite-800 border border-graphite-600 rounded-sm px-3 py-1.5 text-sm text-white"
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => window.print()}
            className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
          >
            🖨 Print {visible.length} QR Code{visible.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500 text-sm">No collection points match this filter.</p>
      ) : (
        <div className="bg-white rounded-sm p-6 print:p-0 print:rounded-none">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
            {visible.map((b) => (
              <div
                key={b.id}
                className="border border-gray-300 rounded-sm p-4 text-center break-inside-avoid print:border-black"
              >
                <p className="font-display text-sm font-bold text-graphite-950">{b.bin_code}</p>
                <p className="text-[11px] text-graphite-600 mb-2">{b.zone_name}</p>
                <div className="flex justify-center mb-2">
                  <QRCodeSVG value={b.bin_code} size={140} />
                </div>
                <p className="text-[10px] text-graphite-500 leading-tight">{b.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
