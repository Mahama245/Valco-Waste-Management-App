import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api";

interface Zone {
  id: number;
  name: string;
  code: string;
}

export default function PrintZoneQrCodes() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/zones")
      .then((res) => setZones(res.data.zones))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Infrastructure</p>
          <h1 className="font-display text-2xl font-semibold text-white">Print Zone QR Codes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Each QR code encodes that zone's unique code. Print, laminate, and post it somewhere visible in the zone —
            the collector assigned to that zone scans it from their My Day page to record that day's collection.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
        >
          🖨 Print {zones.length} QR Code{zones.length !== 1 ? "s" : ""}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading zones...</p>
      ) : zones.length === 0 ? (
        <p className="text-gray-500 text-sm">No zones available.</p>
      ) : (
        <div className="bg-white rounded-sm p-6 print:p-0 print:rounded-none">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
            {zones.map((z) => (
              <div
                key={z.id}
                className="border border-gray-300 rounded-sm p-4 text-center break-inside-avoid print:border-black"
              >
                <p className="font-display text-sm font-bold text-graphite-950">{z.code}</p>
                <p className="text-[11px] text-graphite-600 mb-2">{z.name}</p>
                <div className="flex justify-center mb-2">
                  <QRCodeSVG value={z.code} size={140} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
