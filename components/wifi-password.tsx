"use client";

// The restaurant's Wi-Fi password for customers (More > Wi-Fi password, and answers in the chat)

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** The Wi-Fi password, big and easy to copy */
export function WifiPassword({ password, compact = false }: { password: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* not allowed: they can still read it */ }
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 ${compact ? "px-3 py-2" : "px-4 py-3"}`} data-wifi>
      <span className={`flex-1 min-w-0 break-all font-mono font-bold text-gray-900 select-all ${compact ? "text-base" : "text-xl"}`}>{password}</span>
      <button type="button" onClick={copy} aria-label="Copy the password"
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-white border border-blue-200 text-blue-700 px-2.5 py-1.5 hover:bg-blue-100">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
