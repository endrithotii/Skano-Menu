"use client";

import { useEffect, useState, useRef } from "react";
import { QrCode, Download, Copy, ExternalLink, Smartphone, Printer, Plus, Minus, Table2 } from "lucide-react";
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
  const [tableCount, setTableCount] = useState(0);
  const [tableQrs, setTableQrs] = useState<{ table: number; url: string }[]>([]);
  const [generatingTables, setGeneratingTables] = useState(false);
  const [activeTab, setActiveTab] = useState<"main" | "tables">("main");

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      const r: RestaurantInfo = {
        id: stats.restaurantId,
        name: stats.restaurant.name,
        slug: stats.restaurant.slug,
        primaryColor: "#f97316",
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

  async function generateTableQRs(count: number) {
    if (!restaurant || count < 1) return;
    setGeneratingTables(true);
    const QRCode = (await import("qrcode")).default;
    const origin = window.location.origin;
    const results: { table: number; url: string }[] = [];
    for (let t = 1; t <= count; t++) {
      const tableUrl = `${origin}/r/${restaurant.slug}?table=${t}`;
      const url = await QRCode.toDataURL(tableUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#1f2937", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      results.push({ table: t, url });
    }
    setTableQrs(results);
    setGeneratingTables(false);
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

  async function printAllTables() {
    if (!tableQrs.length || !restaurant) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
<title>${restaurant.name} – Table QR Codes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #fff; }
  h1 { text-align: center; padding: 20px; font-size: 18px; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 24px; }
  .card { border: 1.5px solid #e5e7eb; border-radius: 16px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .card img { width: 160px; height: 160px; display: block; margin: 0 auto 12px; }
  .card .table-label { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .card .restaurant-name { font-size: 11px; color: #6b7280; }
  .card .scan-text { font-size: 10px; color: #9ca3af; margin-top: 6px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>${restaurant.name} — Table QR Codes</h1>
<div class="grid">
${tableQrs.map(({ table, url }) => `
  <div class="card">
    <img src="${url}" alt="Table ${table}" />
    <div class="table-label">Table ${table}</div>
    <div class="restaurant-name">${restaurant.name}</div>
    <div class="scan-text">Scan to view the menu</div>
  </div>
`).join("")}
</div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  const menuUrl = restaurant ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${restaurant.slug}` : "";

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
        <p className="text-sm text-gray-500 mt-1">Main menu QR code + per-table codes for your restaurant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab("main")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "main" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <QrCode className="w-4 h-4 inline mr-1.5 -mt-0.5" />Main QR
        </button>
        <button onClick={() => setActiveTab("tables")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "tables" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <Table2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Table QRs
        </button>
      </div>

      {activeTab === "main" && (
        <>
          {/* Main QR Card */}
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
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 text-sm">
                  <Download className="w-4 h-4" /> Download PNG
                </button>
                <button onClick={() => copyLink(menuUrl)}
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
        </>
      )}

      {activeTab === "tables" && (
        <div className="space-y-5">
          {/* Table count selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Generate Table QR Codes</h2>
            <p className="text-sm text-gray-500 mb-5">Each table gets a unique QR code with its table number embedded in the URL. Customers scanning Table 5 will see "Table 5" on their screen.</p>

            <div className="flex items-center gap-4 mb-5">
              <span className="text-sm font-medium text-gray-700">Number of tables:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setTableCount((n) => Math.max(0, n - 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <span className="w-10 text-center text-lg font-bold text-gray-900">{tableCount}</span>
                <button onClick={() => setTableCount((n) => Math.min(50, n + 1))}
                  className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <span className="text-xs text-gray-400">(max 50)</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => generateTableQRs(tableCount)}
                disabled={tableCount < 1 || generatingTables}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 text-sm shadow-lg shadow-orange-500/25">
                {generatingTables ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating...</>
                ) : (
                  <><QrCode className="w-4 h-4" /> Generate {tableCount > 0 ? tableCount : ""} QR Codes</>
                )}
              </button>
              {tableQrs.length > 0 && (
                <button onClick={printAllTables}
                  className="flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm">
                  <Printer className="w-4 h-4" /> Print All
                </button>
              )}
            </div>
          </div>

          {/* Table QR grid */}
          {tableQrs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Table QR Codes ({tableQrs.length} tables)</h2>
                <button onClick={printAllTables}
                  className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print Sheet
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {tableQrs.map(({ table, url }) => (
                  <div key={table} className="border border-gray-100 rounded-2xl p-3 text-center hover:shadow-md transition-shadow">
                    <img src={url} alt={`Table ${table}`} className="w-full aspect-square rounded-xl mb-2" />
                    <p className="font-bold text-gray-900 text-sm">Table {table}</p>
                    <p className="text-[10px] text-gray-400 mb-2.5">{restaurant?.name}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => downloadQR(url, `table-${table}-qr.png`)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-orange-600 border border-orange-200 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                        <Download className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => copyLink(`${window.location.origin}/r/${restaurant?.slug}?table=${table}`)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-gray-600 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tableQrs.length === 0 && tableCount === 0 && (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <Table2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-500 text-sm">Set the number of tables above and click Generate</p>
              <p className="text-xs text-gray-400 mt-1">Each table gets its own QR code — customers will see their table number</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Print tip:</span> Download the QR code and print at minimum 3×3cm (1.2×1.2 inches) for reliable scanning. Use the Print Sheet to print all tables at once on A4 paper.
        </p>
      </div>
    </div>
  );
}
