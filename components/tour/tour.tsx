"use client";

// "Show me how": a guided tour on the real page. The FAQ opens a page with ?tour=<faq id>.
// The whole page is blurred and dimmed, only the thing to look at or click stays clear (a hole in the blur).
// A small card says what to do. "click" steps go on by themselves when the person clicks the clear thing.
// The steps are in lib/faq.ts (tour). Mounted once in the dashboard layout.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, ArrowLeft, ArrowRight, Check, MousePointerClick } from "lucide-react";
import { findTour, type Tour } from "@/lib/faq";

type Box = { x: number; y: number; w: number; h: number };
const PAD = 8;

function readTour(pathname: string): { id: string; tour: Tour } | null {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("tour");
  const tour = id ? findTour(id) : null;
  return id && tour && tour.path === pathname ? { id, tour } : null;
}

export function GuidedTour() {
  const pathname = usePathname();
  const [active, setActive] = useState<{ id: string; tour: Tour } | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const target = useRef<Element | null>(null);
  // Steps that were skipped (not needed on this page): not counted, and Back jumps over them
  const [skipped, setSkipped] = useState<number[]>([]);

  // Start when the page has ?tour=
  useEffect(() => {
    const t = readTour(pathname);
    void Promise.resolve().then(() => { setActive(t); setI(0); setSkipped([]); });
  }, [pathname]);

  const close = useCallback(() => {
    setActive(null); setBox(null); target.current = null;
    try {
      const u = new URL(window.location.href); u.searchParams.delete("tour");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch { /* fine */ }
  }, []);
  const step = active?.tour.steps[i] ?? null;
  const last = !!active && i === active.tour.steps.length - 1;
  const next = useCallback(() => { if (!active) return; if (i >= active.tour.steps.length - 1) close(); else setI(i + 1); }, [active, i, close]);

  // Find the thing of this step (it can take a moment to appear), skip the step when it isn't needed, and follow it on screen
  useEffect(() => {
    if (!active || !step) return;
    let stop = false, raf = 0, tries = 0, scrolled = false, seen = false;
    target.current = null;
    void Promise.resolve().then(() => { setBox(null); setMissing(false); });
    const tick = () => {
      if (stop) return;
      // Wait until the page has loaded what the step is about
      if (step.waitFor && !document.querySelector(step.waitFor)) { setBox(null); if (++tries > 600) setMissing(true); raf = requestAnimationFrame(tick); return; }
      // Not needed here (decided before the step is shown, a step that was shown counts as done)
      if (step.skipIf && !seen && document.querySelector(step.skipIf)) { setSkipped((x) => (x.includes(i) ? x : [...x, i])); next(); return; }
      const el = document.querySelector(step.target);
      if (el && (el as HTMLElement).offsetParent !== null) {
        target.current = el; seen = true;
        if (!scrolled) { el.scrollIntoView({ block: "center", behavior: "smooth" }); scrolled = true; }
        const r = el.getBoundingClientRect();
        setBox((b) => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
        setVw(window.innerWidth); setVh(window.innerHeight);
        setMissing(false);
      } else {
        target.current = null;
        if (++tries > 300) setMissing(true); // about 5 seconds
        setBox(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [active, step, next, i]);

  // "click" steps: go on when the clear thing is clicked
  useEffect(() => {
    if (!step || step.action !== "click") return;
    const onClick = (e: MouseEvent) => {
      if (target.current && e.target instanceof Node && target.current.contains(e.target)) setTimeout(next, 350);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, next]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);

  if (!active || !step) return null;

  const total = active.tour.steps.length - skipped.length;
  const shown = i + 1 - skipped.filter((k) => k < i).length;
  // Back jumps over steps that were skipped, or that aren't needed now (their skipIf is on the page)
  const notNeeded = (k: number) => { const q = active.tour.steps[k].skipIf; return !!q && typeof document !== "undefined" && !!document.querySelector(q); };
  const back = (() => { for (let k = i - 1; k >= 0; k--) if (!skipped.includes(k) && !notNeeded(k)) return k; return -1; })();
  const hole = box ? { x: Math.max(0, box.x - PAD), y: Math.max(0, box.y - PAD), w: box.w + PAD * 2, h: box.h + PAD * 2 } : null;
  const veil = "fixed z-[90] bg-gray-900/45 backdrop-blur-[3px]";
  // The card: under the clear thing when there is room, otherwise above it (on phones it sits at the bottom)
  const phone = vw > 0 && vw < 640;
  const cardW = phone ? vw - 24 : 340;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: cardW };
  if (hole && phone) {
    const below = hole.y + hole.h + 200 < vh;
    cardStyle = below ? { left: 12, top: Math.min(hole.y + hole.h + 12, vh - 220), width: cardW } : { left: 12, bottom: 12, width: cardW };
    if (!below && hole.y + hole.h > vh - 230) cardStyle = { left: 12, top: 12, width: cardW };
  } else if (hole) {
    const left = Math.min(Math.max(12, hole.x), vw - cardW - 12);
    cardStyle = hole.y + hole.h + 210 < vh ? { left, top: hole.y + hole.h + 12, width: cardW } : hole.y > 220 ? { left, top: hole.y - 12, transform: "translateY(-100%)", width: cardW } : { left: Math.min(hole.x + hole.w + 12, vw - cardW - 12), top: Math.max(12, hole.y), width: cardW };
  }

  return (
    <div data-tour-overlay aria-live="polite">
      {hole ? (
        <>
          {/* Four blurred parts around the hole: the clear thing can still be clicked */}
          <div className={veil} style={{ left: 0, top: 0, width: "100vw", height: hole.y }} />
          <div className={veil} style={{ left: 0, top: hole.y + hole.h, width: "100vw", bottom: 0 }} />
          <div className={veil} style={{ left: 0, top: hole.y, width: hole.x, height: hole.h }} />
          <div className={veil} style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          <div className="fixed z-[91] pointer-events-none rounded-xl ring-4 ring-blue-500/90 shadow-[0_0_0_6px_rgba(59,130,246,0.25)] animate-pulse"
            style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} data-tour-hole />
        </>
      ) : <div className={`${veil} inset-0`} />}

      <div role="dialog" aria-label={step.title} className="fixed z-[92] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 space-y-3" style={cardStyle} data-tour-card>
        <div className="flex items-start gap-2">
          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5 shrink-0">Step {shown} of {total}</span>
          <button type="button" onClick={close} aria-label="Close the guide" className="ml-auto -mt-1 -mr-1 p-1 rounded-lg text-gray-400 hover:bg-gray-100" data-go="tour-close"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <p className="font-bold text-gray-900">{step.title}</p>
          <p className="text-sm text-gray-600 mt-1">{missing ? "We can't find it on this page right now. Press Next to go on, or close the guide." : step.text}</p>
        </div>
        {step.action === "click" && !missing && <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><MousePointerClick className="w-4 h-4" aria-hidden /> Click the highlighted part to go on</p>}
        <div className="flex items-center gap-2">
          {back >= 0 && <button type="button" onClick={() => setI(back)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 px-2 py-2" data-go="tour-back"><ArrowLeft className="w-4 h-4" /> Back</button>}
          {!last && <button type="button" onClick={close} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-2 py-2" data-go="tour-skip">Skip</button>}
          {(step.action === "next" || missing) && (
            <button type="button" onClick={next} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2" data-go="tour-next">
              {last ? <><Check className="w-4 h-4" /> Done</> : <>Next <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
