"use client";

import { useEffect, useState, useRef } from "react";
import { QrCode, Download, Copy, ExternalLink, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

export default function QRCodePage() {
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string; primaryColor: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      setRestaurant({ id: stats.restaurantId, name: stats.restaurant.name, slug: stats.restaurant.slug, primaryColor: "#f97316" });

      const menuUrl = `${window.location.origin}/r/${stats.restaurant.slug}`;
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(menuUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#1f2937", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(url);
      setLoading(false);
    }
    load();
  }, []);

  function downloadQR() {
    if (!qrDataUrl || !restaurant) return;
    const link = document.createElement("a");
    link.download = `${restaurant.name.toLowerCase().replace(/\s+/g, "-")}-qr-menu.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success("QR Code downloaded!");
  }

  function copyLink() {
    if (!restaurant) return;
    navigator.clipboard.writeText(`${window.location.origin}/r/${restaurant.slug}`);
    toast.success("Link copied to clipboard!");
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  const menuUrl = restaurant ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${restaurant.slug}` : "";

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
        <p className="text-sm text-gray-500 mt-1">Your unique menu QR code for table placement</p>
      </div>

      {/* QR Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
          <div className="flex items-center gap-3">
            <QrCode className="w-6 h-6" />
            <div>
              <div className="font-bold">{restaurant?.name}</div>
              <div className="text-orange-100 text-sm">Digital Menu QR Code</div>
            </div>
          </div>
        </div>

        <div className="p-8 flex flex-col items-center">
          {qrDataUrl ? (
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl" />
              <div className="relative bg-white p-4 rounded-xl shadow-inner">
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center">
              <QrCode className="w-12 h-12 text-gray-400" />
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 mb-1">Scan to open menu</p>
            <p className="text-sm font-medium text-gray-900 break-all max-w-xs">{menuUrl}</p>
          </div>

          <div className="flex gap-3 mt-6 w-full max-w-xs">
            <button onClick={downloadQR}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 text-sm">
              <Download className="w-4 h-4" /> Download PNG
            </button>
            <button onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm">
              <Copy className="w-4 h-4" /> Copy Link
            </button>
          </div>

          {restaurant && (
            <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium">
              <ExternalLink className="w-3.5 h-3.5" /> Preview menu in new tab
            </a>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-orange-500" /> Placement Tips
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: "Table tents", desc: "Print and fold for tabletop display. Works great for casual dining." },
            { title: "Acrylic stands", desc: "Professional look for fine dining. Use UV-resistant print." },
            { title: "Stickers on tables", desc: "Low cost option. Place near the center of each table." },
            { title: "Entry/reception area", desc: "Let guests preview the menu before being seated." },
          ].map((tip) => (
            <div key={tip.title} className="bg-orange-50 rounded-xl p-3">
              <div className="font-medium text-gray-900 text-sm mb-1">{tip.title}</div>
              <div className="text-xs text-gray-600">{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Print instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Print tip:</span> Download the QR code and print at a minimum size of 3×3cm (1.2×1.2 inches) for reliable scanning. Higher contrast backgrounds yield better results.
        </p>
      </div>
    </div>
  );
}
