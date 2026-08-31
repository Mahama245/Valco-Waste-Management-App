import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  label?: string;
  hint?: string;
}

const SCANNER_ELEMENT_ID = "qr-reader-region";

export default function QrScanner({ onScan, onClose, label, hint }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          setScanning(false);
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {
          // fired continuously while no code is found — expected, ignore
        }
      )
      .catch(() => {
        setError("Couldn't access the camera. Check your browser's camera permission for this site.");
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-white font-medium">{label || "Scan bin QR code"}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">
            Cancel
          </button>
        </div>

        {error ? (
          <p className="text-status-critical text-sm py-8 text-center">{error}</p>
        ) : (
          <>
            <div id={SCANNER_ELEMENT_ID} className="rounded-sm overflow-hidden bg-black" />
            {scanning && <p className="text-xs text-gray-500 text-center mt-3">{hint || "Point your camera at the bin's QR code."}</p>}
          </>
        )}
      </div>
    </div>
  );
}
