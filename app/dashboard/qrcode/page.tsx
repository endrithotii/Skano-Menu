"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Download, Copy, ExternalLink, Smartphone, CalendarCheck } from "lucide-react";
import toast from "react-hot-toast";

interface RestaurantInfo { id: string; name: string; slug: string }

async function makeQr(url: string) {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: "#1f2937", light: "#ffffff" }, errorCorrectionLevel: "H" });
}

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

/** One QR code with its link, download and preview */
function QrCard({ title, subtitle, url, image, file, gradient, scanText, preview, id, children }: {
  title: string; subtitle: string; url: string; image: string; file: string; gradient: string; scanText: string; preview: string; id: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" data-qr={id}>
      <div className={`${gradient} p-5 text-white`}>
        <div className="flex items-center gap-3">
          {id === "reserve" ? <CalendarCheck className="w-6 h-6" /> : <QrCode className="w-6 h-6" />}
          <div>
            <div className="font-bold">{title}</div>
            <div className="text-white/80 text-sm">{subtitle}</div>
          </div>
        </div>
      </div>
      <div className="p-8 flex flex-col items-center flex-1">
        {image ? (
          <div className="relative">
            <div className="absolute -inset-3 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl" />
            <div className="relative bg-white p-4 rounded-xl shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`${title} QR code`} className="w-56 h-56" />
            </div>
          </div>
        ) : (
          <div className="w-56 h-56 bg-gray-100 rounded-xl flex items-center justify-center"><QrCode className="w-12 h-12 text-gray-400" /></div>
        )}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 mb-1">{scanText}</p>
          <p className="text-sm font-medium text-gray-900 break-all max-w-xs">{url}</p>
        </div>
        <div className="flex gap-3 mt-6 w-full max-w-xs">
          <button onClick={() => downloadQR(image, file)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-all text-sm">
            <Download className="w-4 h-4" /> Download PNG
          </button>
          <button onClick={() => copyLink(url)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <ExternalLink className="w-3.5 h-3.5" /> {preview}
        </a>
        {children}
      </div>
    </div>
  );
}

export default function QRCodePage() {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [menuQr, setMenuQr] = useState("");
  const [reserveQr, setReserveQr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stats = await fetch("/api/dashboard/stats").then((r) => r.json());
      const r: RestaurantInfo = { id: stats.restaurantId, name: stats.restaurant.name, slug: stats.restaurant.slug };
      setRestaurant(r);
      const origin = window.location.origin;
      setMenuQr(await makeQr(`${origin}/r/${r.slug}`));
      setReserveQr(await makeQr(`${origin}/reserve/${r.slug}`));
      setLoading(false);
    })();
  }, []);

  if (loading || !restaurant) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const menuUrl = `${origin}/r/${restaurant.slug}`;
  const reserveUrl = `${origin}/reserve/${restaurant.slug}`;

  return (
    <div className="p-4 lg:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
        <p className="text-sm text-gray-500 mt-1">One QR code opens your menu, the other one lets customers reserve a table</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <QrCard id="menu" title={restaurant.name} subtitle="Digital Menu QR Code" url={menuUrl} image={menuQr} file={`${restaurant.slug}-menu-qr.png`}
          gradient="bg-gradient-to-r from-blue-500 to-indigo-500" scanText="Scan to open menu" preview="Preview menu in new tab" />
        <QrCard id="reserve" title={restaurant.name} subtitle="Reserve a table QR Code" url={reserveUrl} image={reserveQr} file={`${restaurant.slug}-reserve-qr.png`}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500" scanText="Scan to reserve a table" preview="Preview the reservation page">
          <p className="mt-4 text-xs text-gray-500 text-center max-w-xs">
            Customers pick a day, a time and a table from your <Link href="/dashboard/floor-plan" className="font-semibold text-blue-600">Floor plan</Link>. You accept or refuse on <Link href="/dashboard/reservations" className="font-semibold text-blue-600">Reservations</Link>.
          </p>
        </QrCard>
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
                { title: "Reservations", desc: "Put the reservation QR code on your door, website, receipts and social media." },
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
