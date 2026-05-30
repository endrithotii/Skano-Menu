"use client";
import { useEffect, useState, useRef } from "react";
import { QrCode, Download, Plus, Trash2, Printer } from "lucide-react";

// Simple QR code URL generator using a public API
const QR_API = (url: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

interface TableQR { tableNumber: string; url: string; }

export default function QRBulkPage() {
  const [slug, setSlug] = useState("");
  const [tables, setTables] = useState<TableQR[]>([]);
  const [newTable, setNewTable] = useState("");
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("https://skano-menu.vercel.app");

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      const d = await fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json());
      setSlug(d.restaurant.slug);
      // Pre-populate from table map if available
      const tm = await fetch(`/api/restaurants/${s.restaurantId}/table-map`).then(r => r.json()).catch(() => ({}));
      if (tm.tables?.length) {
        setTables(tm.tables.map((t: any) => ({ tableNumber: t.label, url: `${baseUrl}/r/${d.restaurant.slug}?table=${t.label}` })));
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addTable() {
    const n = newTable.trim();
    if (!n || tables.find(t => t.tableNumber === n)) return;
    setTables(t => [...t, { tableNumber: n, url: `${baseUrl}/r/${slug}?table=${n}` }]);
    setNewTable("");
  }

  function generateRange() {
    const count = parseInt(prompt("Generate QR codes for how many tables? (e.g. 20)") ?? "0");
    if (!count || count < 1 || count > 100) return;
    const newTables: TableQR[] = [];
    for (let i = 1; i <= count; i++) {
      const n = String(i);
      if (!tables.find(t => t.tableNumber === n)) {
        newTables.push({ tableNumber: n, url: `${baseUrl}/r/${slug}?table=${n}` });
      }
    }
    setTables(t => [...t, ...newTables]);
  }

  function printAll() {
    window.print();
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><QrCode className="w-6 h-6 text-orange-500" /> QR Code Generator</h1>
          <p className="text-sm text-gray-500 mt-1">Generate QR codes for all your tables with pre-filled table numbers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateRange} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Range
          </button>
          <button onClick={printAll} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <Printer className="w-4 h-4" /> Print All
          </button>
        </div>
      </div>

      {/* Add single table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-2">
        <input value={newTable} onChange={e => setNewTable(e.target.value)} onKeyDown={e => e.key === "Enter" && addTable()}
          placeholder="Table number (e.g. 1, A1, VIP)" className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
        <button onClick={addTable} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl"><Plus className="w-4 h-4" /> Add</button>
      </div>

      {/* QR grid */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <QrCode className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No tables yet</p>
          <p className="text-sm text-gray-400 mt-1">Add table numbers or click "Range" to generate 1–N</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tables.length} table{tables.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 print:grid-cols-4">
            {tables.map(t => (
              <div key={t.tableNumber} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 print:border print:shadow-none print:rounded-lg">
                <img src={QR_API(t.url)} alt={`QR Table ${t.tableNumber}`} className="w-28 h-28 rounded-lg" />
                <p className="font-bold text-gray-900 text-lg">Table {t.tableNumber}</p>
                <p className="text-[9px] text-gray-400 text-center break-all px-1 print:hidden">{t.url.replace("https://","")}</p>
                <div className="flex gap-1 print:hidden">
                  <a href={QR_API(t.url)} download={`table-${t.tableNumber}.png`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-semibold rounded-lg transition-colors">
                    <Download className="w-3 h-3" /> Save
                  </a>
                  <button onClick={() => setTables(tt => tt.filter(x => x.tableNumber !== t.tableNumber))}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
