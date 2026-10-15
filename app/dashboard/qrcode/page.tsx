"use client";

import { useEffect, useState } from "react";
import { QrCode, Download, Copy, ExternalLink, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

export default function QRCodePage() {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      const r: RestaurantInfo = {
        id: stats.restaurantId,
        name: stats.restaurant.name,
        slug: stats.restaurant.slug,
        primaryColor: "#3b82f6",
      };
      setRestaurant(r);

      const origin = window.location.origin;
      const menuUrl = `${origin}/r/${stats.restaurant.slug}`;
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

  function downloadQR(dataUrl: string, filename: string) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    toast.success("Downloaded!");
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  const menuUrl = restaurant ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${restaurant.slug}` : "";

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
        <p className="text-sm text-gray-500 mt-1">The QR code customers scan to open your menu</p>
      </div>

          {/* Main QR Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-5 text-white">
              <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6" />
                <div>
                  <div className="font-bold">{restaurant?.name}</div>
                  <div className="text-blue-100 text-sm">Digital Menu QR Code</div>
                </div>
              </div>
            </div>

            <div className="p-8 flex flex-col items-center">
              {qrDataUrl ? (
                <div className="relative">
                  <div className="absolute -inset-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl" />
                  <div className="relative bg-white p-4 rounded-xl shadow-inner">
                    <img src={qrDataUrl} alt="Menu QR Code" className="w-64 h-64" />
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
                <button onClick={() => downloadQR(qrDataUrl, `${restaurant?.slug}-menu-qr.png`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 text-sm">
                  <Download className="w-4 h-4" /> Download PNG
                </button>
                <button onClick={() => copyLink(menuUrl)}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm">
                  <Copy className="w-4 h-4" /> Copy Link
                </button>
              </div>

              {restaurant && (
                <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview menu in new tab
                </a>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-500" /> Placement Tips
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Table tents", desc: "Print and fold for tabletop display. Works great for casual dining." },
                { title: "Acrylic stands", desc: "Professional look for fine dining. Use UV-resistant print." },
                { title: "Stickers on tables", desc: "Low cost option. Place near the center of each table." },
                { title: "Entry/reception area", desc: "Let guests preview the menu before being seated." },
              ].map((tip) => (
                <div key={tip.title} className="bg-blue-50 rounded-xl p-3">
                  <div className="font-medium text-gray-900 text-sm mb-1">{tip.title}</div>
                  <div className="text-xs text-gray-600">{tip.desc}</div>
                </div>
              ))}
            </div>
          </div>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Print tip:</span> Download the QR code and print at minimum 3×3cm (1.2×1.2 inches) for reliable scanning.
        </p>
      </div>
    </div>
  );
}
