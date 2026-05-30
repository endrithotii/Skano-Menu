"use client";
import { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";

interface AuditEntry { id: string; userId: string; userName: string; userEmail: string; restaurantId: string; action: string; entity: string; entityId: string; detail: string; createdAt: string; }

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/admin/audit-log?limit=100").then(r => r.json());
    setLogs(d.logs ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const actionColor = (a: string) => {
    if (a.includes("delete") || a.includes("remove")) return "bg-red-100 text-red-700";
    if (a.includes("create") || a.includes("add")) return "bg-green-100 text-green-700";
    if (a.includes("update") || a.includes("edit")) return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-6 h-6 text-orange-500" /> Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">All platform actions — last 100 entries</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No audit log entries yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b border-gray-100 bg-gray-50">{["Time","User","Action","Entity","Detail"].map(h=><th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                    <td className="px-4 py-3"><p className="text-xs font-medium text-gray-800">{log.userName || "—"}</p><p className="text-[10px] text-gray-400 truncate max-w-[120px]">{log.userEmail}</p></td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${actionColor(log.action)}`}>{log.action}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-700">{log.entity}</span>{log.entityId && <span className="text-[10px] text-gray-400 ml-1 font-mono">{log.entityId?.slice(0,8)}</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{log.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
