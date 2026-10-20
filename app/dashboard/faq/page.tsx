"use client";

// FAQ: answers to "how do I..." questions. Everyone sees the questions about pages they may open. The questions are in lib/faq.ts.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleHelp, ChevronDown, Search, ArrowRight, Lightbulb } from "lucide-react";
import { FAQ, type FaqItem } from "@/lib/faq";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";

function Item({ f, open, onToggle }: { f: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className={`${card} overflow-hidden`} data-faq={f.id}>
      <h3>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`faq-${f.id}`}
          className="w-full flex items-center gap-3 text-left px-5 py-4 hover:bg-gray-50">
          <span className="flex-1 font-semibold text-gray-900">{f.question}</span>
          <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={`faq-${f.id}`} className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-700">{f.answer}</p>
          {f.steps && (
            <ol className="space-y-2.5">
              {f.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-800">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0" aria-hidden>{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
          {f.tips && f.tips.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" aria-hidden /> Good to know</p>
              <ul className="space-y-1 text-sm text-amber-950 list-disc pl-5">
                {f.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {f.link && (
            <Link href={f.link.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-4 py-2.5" data-faq-open>
              {f.link.label} <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [access, setAccess] = useState<{ owner: boolean; permissions: string[] } | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/access").then((r) => (r.ok ? r.json() : null))
      .then((a) => setAccess({ owner: !!a?.owner, permissions: a?.permissions ?? [] }))
      .catch(() => setAccess({ owner: false, permissions: [] }));
    // A link like /dashboard/faq#design-template opens that question
    const hash = window.location.hash.slice(1);
    if (hash) void Promise.resolve().then(() => setOpen(hash));
  }, []);

  const groups = useMemo(() => {
    if (!access) return [];
    const may = (f: FaqItem) => access.owner || f.need.length === 0 || f.need.some((p) => access.permissions.includes(p));
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (f: FaqItem) => {
      const text = [f.question, f.answer, ...(f.steps ?? []), ...(f.tips ?? [])].join(" ").toLowerCase();
      return words.every((w) => text.includes(w));
    };
    return FAQ.map((g) => ({ ...g, items: g.items.filter((f) => may(f) && hit(f)) })).filter((g) => g.items.length);
  }, [access, q]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CircleHelp className="w-6 h-6 text-blue-600" aria-hidden /> FAQ</h1>
        <p className="text-sm text-gray-500 mt-1">Answers to the questions people ask most, step by step.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden />
        <label htmlFor="faq-q" className="sr-only">Search the questions</label>
        <input id="faq-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example: template"
          className="w-full text-sm bg-white border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
      </div>

      {!access ? (
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      ) : groups.length === 0 ? (
        <div className={`${card} p-8 text-center text-sm text-gray-500`} data-faq-empty>
          {q.trim() ? "No question matches your search." : "No questions for your pages yet."}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="space-y-3" aria-label={g.name} data-faq-group={g.name}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{g.name}</h2>
            {g.items.map((f) => <Item key={f.id} f={f} open={open === f.id || (!!q.trim() && groups.flatMap((x) => x.items).length === 1)} onToggle={() => setOpen((o) => (o === f.id ? null : f.id))} />)}
          </section>
        ))
      )}
    </div>
  );
}
