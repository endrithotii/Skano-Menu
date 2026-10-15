"use client";

// Customers ask about the dishes (public menu > More > Ask about the dishes).
// The answers come only from the kitchen's details, and always point to the waiter for anything serious.

import { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, X, Send, Loader2, AlertTriangle, Clock } from "lucide-react";

interface AnswerDish { name: string; section: string; menu: string; ingredients: string; minutes: number | null; note: string; price?: number | null; count?: number }
interface Plan { title: string; total: number; courses: { course: string; dishes: AnswerDish[] }[] }
interface Answer { kind: string; title: string; dishes: AnswerDish[]; plans?: Plan[]; currency?: string; notes: string[]; warning: string }

/** "€12.50", "1200 Lek", "CHF 9" */
const formatPrice = (n: number, currency = "€") => {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  if (/^[A-Za-z]/.test(currency)) return currency === "CHF" ? `CHF ${v}` : `${v} ${currency}`;
  return `${currency}${v}`;
};
interface Turn { question: string; answer: Answer | null; error?: string }

// The conversation is kept while the menu tab is open (closing and opening the pop-up, or reloading, keeps it)
const chatKey = (restaurant: string) => `skano.ask.${restaurant}`;
function readChat(restaurant: string): Turn[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(chatKey(restaurant)) || "[]");
    return Array.isArray(v) ? v.filter((t) => t && typeof t.question === "string" && (t.answer || t.error)) : [];
  } catch {
    return [];
  }
}

const EXAMPLES = ["I'm allergic to peanuts", "Which main dish comes the quickest?", "Vegetarian dishes", "I have 50 euros, a starter, main and dessert for 2"];

export function AskSheet({ restaurant, onClose }: { restaurant: string; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>(() => readChat(restaurant));
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);
  // Save the finished questions and answers for this tab
  useEffect(() => {
    try { sessionStorage.setItem(chatKey(restaurant), JSON.stringify(turns.filter((t) => t.answer || t.error).slice(-30))); } catch { /* private mode */ }
  }, [turns, restaurant]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuestion("");
    setTurns((t) => [...t, { question: text, answer: null }]);
    const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    setTurns((t) => t.map((x, i) => (i === t.length - 1
      ? (res?.ok && d?.answer ? { ...x, answer: d.answer } : { ...x, error: d?.error ?? "Could not answer right now. Please ask the waiter." })
      : x)));
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Ask about the dishes" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2"><MessageCircleQuestion className="w-5 h-5 text-blue-600" /> Ask about the dishes</h2>
          <p className="text-xs text-gray-500 mt-0.5 pr-8">Answers use only what the kitchen wrote about each dish. For allergies, always check with the waiter too.</p>
          {turns.length > 0 && !busy && (
            <button type="button" onClick={() => setTurns([])} className="mt-1 text-xs font-medium text-gray-500 underline hover:text-gray-800">Clear the chat</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!turns.length && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Ask about ingredients, allergies or how long a dish takes. For example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button key={e} type="button" onClick={() => ask(e)} className="text-sm rounded-full border border-blue-200 bg-blue-50 text-blue-800 px-3 py-1.5 hover:bg-blue-100">{e}</button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-900 text-white text-sm px-3.5 py-2">{t.question}</div></div>
              {!t.answer && !t.error && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Checking the kitchen&apos;s details…</div>}
              {t.error && <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-700">{t.error}</div>}
              {t.answer && (
                <div className="rounded-2xl rounded-bl-md bg-gray-50 border border-gray-100 p-3.5 space-y-2.5" data-answer>
                  <p className="text-sm font-semibold text-gray-900">{t.answer.title}</p>
                  {t.answer.dishes.length > 0 && (
                    <ul className="space-y-2">
                      {t.answer.dishes.map((d, j) => (
                        <li key={j} className="rounded-xl bg-white border border-gray-100 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900">{d.name}</span>
                            <span className="shrink-0 flex items-center gap-2">
                              {d.minutes ? <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600"><Clock className="w-3 h-3" /> about {d.minutes} min</span> : null}
                              {typeof d.price === "number" && <span className="text-sm font-semibold text-gray-900">{formatPrice(d.price, t.answer!.currency)}</span>}
                            </span>
                          </div>
                          {d.section && <div className="text-[11px] text-gray-400">{d.section}</div>}
                          {d.ingredients && <div className="text-xs text-gray-600 mt-0.5">Ingredients: {d.ingredients}</div>}
                          {d.note && <div className="text-xs text-gray-500 mt-0.5">Note: {d.note}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.answer.plans?.map((p, j) => (
                    <div key={j} className="rounded-xl bg-white border border-gray-100 px-3 py-2.5" data-plan>
                      <div className="text-sm font-bold text-gray-900">{p.title}</div>
                      <div className="mt-1.5 space-y-1.5">
                        {p.courses.map((c) => (
                          <div key={c.course}>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{c.course}</div>
                            {c.dishes.map((d, k) => (
                              <div key={k} className="flex items-start justify-between gap-2 text-sm">
                                <span className="text-gray-800">{(d.count ?? 1) > 1 ? `${d.count} × ` : ""}{d.name}</span>
                                {typeof d.price === "number" && (
                                  <span className="shrink-0 text-gray-600">{(d.count ?? 1) > 1 ? `${d.count} × ${formatPrice(d.price, t.answer!.currency)}` : formatPrice(d.price, t.answer!.currency)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {t.answer.notes.map((n, j) => <p key={j} className="text-xs text-gray-500">{n}</p>)}
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> <span>{t.answer.warning}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void ask(question); }} className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input id="ask-input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Type your question…"
            className="flex-1 min-w-0 text-base border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <button type="submit" disabled={!question.trim() || busy} aria-label="Send"
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
