"use client";

// Landing page hero: a scroll story in five layers.
// 1 a QR code, 2 it stands on a table in a brass holder, 3 a hand scans it with a phone,
// 4 the menu opens on the phone, 5 a dish is served on the same table.
// The whole story is one sticky stage, driven by how far the page is scrolled.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue,
} from "framer-motion";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

const QR_URL = "https://skano-menu.vercel.app/restaurants";

// One colour set per layer: background, text and accent
const SCENES = [
  { bg: "#F3EDE4", ink: "#191714", accent: "#A8763E" },
  { bg: "#EBCFC0", ink: "#1E1512", accent: "#9C4F35" },
  { bg: "#C9D5C2", ink: "#142019", accent: "#3F6B4E" },
  { bg: "#12172A", ink: "#F3EDE4", accent: "#D9B77E" },
  { bg: "#EADDC4", ink: "#191714", accent: "#8E5B2C" },
];

const COPY = [
  { kicker: "The digital menu, refined", title: ["One", "code"], text: "Your whole menu in one small square. Photos, prices, specials, allergens, all of it." },
  { kicker: "Set the table", title: ["On every", "table"], text: "Printed on fine card, set in a brass stand. Each table gets its own code." },
  { kicker: "The scan", title: ["One", "glance"], text: "No app and no download. Guests point their camera and the menu opens." },
  { kicker: "The menu", title: ["Always", "fresh"], text: "Change a price or sell out a dish, and it's live on every phone in seconds." },
  { kicker: "The moment", title: ["Then,", "dinner"], text: "From scan to plate. Guests choose faster, and you see every scan and rating." },
];

const N = SCENES.length;
const step = 1 / N;

/** QR code modules as one SVG path, drawn in a box of the given size */
function useQrPath(size: number) {
  return useMemo(() => {
    const qr = QRCode.create(QR_URL, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const m = size / n;
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${(x * m).toFixed(2)} ${(y * m).toFixed(2)}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`;
      }
    }
    return d;
  }, [size]);
}

/** Shorthand: a value that follows scroll progress p through the given points */
function useT<T extends string | number>(p: MotionValue<number>, input: number[], output: T[]) {
  return useTransform(p, input, output);
}

export function LayersStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // A little smoothing so the drawing glides instead of jumping with the wheel
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });

  const [scene, setScene] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScene(Math.min(N - 1, Math.floor(v * N + 0.0001)));
  });

  // Background and text colour blend from layer to layer
  const stops = SCENES.flatMap((_, i) => [i * step + (i ? 0.02 : 0), (i + 1) * step - 0.02]);
  const bg = useTransform(p, stops, SCENES.flatMap((s) => [s.bg, s.bg]));
  const ink = useTransform(p, stops, SCENES.flatMap((s) => [s.ink, s.ink]));
  const accent = useTransform(p, stops, SCENES.flatMap((s) => [s.accent, s.accent]));

  return (
    <section ref={ref} className="relative" style={{ height: `${N * 110 + 40}svh` }} aria-label="How SkanoMenu works">
      <motion.div className="sticky top-0 h-[100svh] overflow-hidden" style={{ backgroundColor: bg, color: ink }}>
        {/* Soft paper grain so the colours don't look flat */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply"
          style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.6) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />

        {/* Big ghost number of the layer */}
        <motion.div aria-hidden className="pointer-events-none absolute -right-6 bottom-[-4vw] font-[family-name:var(--font-display)] leading-none select-none opacity-[0.07] text-[38vw] md:text-[24vw]">
          {String(scene + 1).padStart(2, "0")}
        </motion.div>

        <div className="relative h-full max-w-7xl mx-auto px-5 sm:px-8 pt-20 pb-6 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
          {/* Words */}
          <div className="relative md:w-[44%] h-[34svh] md:h-auto md:min-h-[22rem] shrink-0">
            {COPY.map((c, i) => <SceneCopy key={i} i={i} p={p} c={c} accent={accent} />)}
          </div>

          {/* Drawing */}
          <div className="relative flex-1 min-h-0 self-stretch flex items-center justify-center">
            <Visual p={p} accent={accent} />
          </div>
        </div>

        {/* Layer counter and dots */}
        <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-center gap-2" aria-hidden>
          {SCENES.map((_, i) => (
            <span key={i} className={`block rounded-full transition-all duration-300 ${i === scene ? "w-2 h-6 bg-current" : "w-2 h-2 bg-current opacity-30"}`} />
          ))}
        </div>
        <div className="absolute left-5 sm:left-8 bottom-5 text-xs font-semibold tracking-[0.2em] opacity-70 tabular-nums">
          {String(scene + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </div>
        <motion.div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex flex-col items-center text-xs font-medium opacity-70"
          style={{ opacity: useTransform(p, [0, 0.06], [0.7, 0]) }}>
          Scroll
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function SceneCopy({ i, p, c, accent }: { i: number; p: MotionValue<number>; c: (typeof COPY)[number]; accent: MotionValue<string> }) {
  const a = i * step, b = (i + 1) * step;
  const first = i === 0, last = i === N - 1;
  const opacity = useTransform(p,
    first ? [0, b - 0.05, b - 0.01] : last ? [a - 0.01, a + 0.04, 1] : [a - 0.01, a + 0.04, b - 0.05, b - 0.01],
    first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0]);
  const y = useTransform(p,
    first ? [0, b - 0.05, b] : last ? [a - 0.01, a + 0.05, 1] : [a - 0.01, a + 0.05, b - 0.05, b],
    first ? [0, 0, -40] : last ? [40, 0, 0] : [40, 0, 0, -40]);
  const pointerEvents = useTransform(opacity, (v) => (v > 0.6 ? "auto" : "none"));
  const H = first ? "h1" : "h2";

  return (
    <motion.div className="absolute inset-0 flex flex-col justify-center" style={{ opacity, y, pointerEvents }}>
      <motion.div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] mb-3 sm:mb-4 flex items-center gap-2" style={{ color: accent }}>
        <span className="tabular-nums">N° {String(i + 1).padStart(2, "0")}</span>
        <span className="inline-block w-8 h-px bg-current" /> {c.kicker}
      </motion.div>
      <H className="font-[family-name:var(--font-display)] uppercase leading-[0.92] tracking-tight text-[13vw] sm:text-6xl lg:text-7xl xl:text-8xl">
        {c.title[0]}<br /><motion.em className="italic normal-case font-normal" style={{ color: accent }}>{c.title[1]}</motion.em>
      </H>
      <p className="mt-3 sm:mt-5 max-w-md text-sm sm:text-base lg:text-lg leading-relaxed opacity-80">{c.text}</p>
      {(first || last) && (
        <div className="mt-4 sm:mt-7 flex flex-wrap gap-3">
          <Link href="/register?plan=premium"
            className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1F] text-white text-sm sm:text-base font-semibold px-5 sm:px-6 py-2.5 sm:py-3 hover:bg-black transition-colors shadow-lg shadow-black/10">
            Try 14 days free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/restaurants"
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-current text-sm sm:text-base font-semibold px-5 sm:px-6 py-2 sm:py-2.5 hover:bg-black/5 transition-colors">
            Browse menus <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ── The picture: a real 3D table, or the drawing when the browser can't do 3D ──

function Visual({ p, accent }: { p: MotionValue<number>; accent: MotionValue<string> }) {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "3d" | "svg">("loading");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const mod = await import("./table-scene");
      if (disposed) return;
      if (!host.current || !mod.webglAvailable()) { setMode("svg"); return; }
      // Use the page's serif on the card and the phone menu
      const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "Georgia, serif";
      try { await document.fonts.load(`600 40px ${serif}`); await document.fonts.load(`italic 400 40px ${serif}`); } catch {}
      if (disposed || !host.current) return;
      let scene: import("./table-scene").SceneHandle;
      try { scene = mod.createTableScene(host.current, { qrUrl: QR_URL, serif }); } catch { setMode("svg"); return; }
      const el = host.current;
      const fit = () => scene.resize(el.clientWidth, el.clientHeight);
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      scene.update(p.get());
      const off = p.on("change", (v) => scene.update(v));
      // Pause drawing while the story is off screen
      const io = new IntersectionObserver(([e]) => scene.setRunning(e.isIntersecting));
      io.observe(el);
      setMode("3d");
      cleanup = () => { off(); ro.disconnect(); io.disconnect(); scene.dispose(); };
    })();
    return () => { disposed = true; cleanup(); };
  }, [p]);

  if (mode === "svg") return <Stage p={p} accent={accent} />;
  return (
    <div className="absolute inset-0">
      {/* Soft fade at the edges so the scene floats in the colour instead of sitting in a box */}
      <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${mode === "3d" ? "opacity-100" : "opacity-0"}`}
        style={{ maskImage: FADE, WebkitMaskImage: FADE }} />
      {mode === "3d" && <Overlays p={p} accent={accent} />}
    </div>
  );
}

const FADE = "radial-gradient(ellipse 62% 58% at 50% 46%, #000 58%, transparent 100%)";

/** Small glass labels over the 3D picture */
function Overlays({ p, accent }: { p: MotionValue<number>; accent: MotionValue<string> }) {
  const chip = "absolute rounded-2xl border border-white/30 bg-white/15 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-4 py-2.5";
  const show = (a: number, b: number) => [a, a + 0.025, b - 0.02, b];
  const o1 = useTransform(p, show(0.03, 0.15), [0, 1, 1, 0]);
  const o2 = useTransform(p, show(0.32, 0.4), [0, 1, 1, 0]);
  const o3 = useTransform(p, show(0.5, 0.59), [0, 1, 1, 0]);
  const o4 = useTransform(p, show(0.65, 0.8), [0, 1, 1, 0]);
  const o5 = useTransform(p, [0.94, 0.97], [0, 1]);
  const bars = [34, 52, 41, 66, 58, 84, 74];
  return (
    <div className="pointer-events-none absolute inset-0 text-[11px] sm:text-xs">
      <motion.div className={`${chip} left-[6%] bottom-[14%]`} style={{ opacity: o1 }}>
        <div className="font-semibold">A real code</div><div className="opacity-70">Point your camera at it</div>
      </motion.div>
      <motion.div className={`${chip} left-[4%] top-[18%]`} style={{ opacity: o2 }}>
        <div className="font-semibold">Brass stand, glass plate</div><div className="opacity-70">One code per table</div>
      </motion.div>
      <motion.div className={`${chip} right-[4%] top-[12%]`} style={{ opacity: o3 }}>
        <div className="font-semibold">No app needed</div><div className="opacity-70">Opens in under a second</div>
      </motion.div>
      <motion.div className={`${chip} right-0 sm:right-[4%] top-0 sm:top-[8%] w-36 sm:w-48`} style={{ opacity: o4 }}>
        <div className="opacity-80">Scans this week</div>
        <div className="flex items-baseline gap-2"><span className="text-lg sm:text-xl font-bold">1,247</span><motion.span className="font-bold" style={{ color: accent }}>▲ 32%</motion.span></div>
        <div className="mt-2 flex items-end gap-1 h-10">
          {bars.map((h, k) => <Bar2 key={k} p={p} k={k} h={h} accent={accent} />)}
        </div>
      </motion.div>
      <motion.div className={`${chip} hidden sm:block left-[4%] bottom-[16%]`} style={{ opacity: o4 }}>
        <div className="font-semibold">★ 4.9 dish rating</div><div className="opacity-70">Live in 3 seconds</div>
      </motion.div>
      <motion.div className={`${chip} right-[4%] bottom-[12%]`} style={{ opacity: o5 }}>
        <div className="font-semibold">Rated 5★</div><div className="opacity-70">Right after the meal</div>
      </motion.div>
    </div>
  );
}

function Bar2({ p, k, h, accent }: { p: MotionValue<number>; k: number; h: number; accent: MotionValue<string> }) {
  const s = useTransform(p, [0.65 + k * 0.012, 0.7 + k * 0.012], [0, 1]);
  const height = useTransform(s, (v) => `${h * v}%`);
  return <motion.span className="flex-1 rounded-sm" style={{ height, backgroundColor: k === 5 ? accent : "currentColor", opacity: k === 5 ? 1 : 0.4 }} />;
}

// ── The drawing (used when the browser can't show 3D) ───────────────────────
// One SVG, 600 × 600. The QR card sits in its holder at (300, 365).

const SKIN = "#E9B48F", SKIN_DARK = "#CF916B", SLEEVE = "#2F6B45";

function Stage({ p, accent }: { p: MotionValue<number>; accent: MotionValue<string> }) {
  const qr = useQrPath(96);

  // Layer 1 → 2: the card flies from the middle into the holder
  const cardY = useT(p, [0, 0.21, 0.34], [-95, -95, 0]);
  const cardS = useT(p, [0, 0.21, 0.34], [1.7, 1.7, 1]);
  const cardR = useT(p, [0, 0.21, 0.34], [-7, -7, 0]);
  const tableY = useT(p, [0.17, 0.3], [240, 0]);
  const tableO = useT(p, [0.17, 0.25], [0, 1]);
  const holderY = useT(p, [0.2, 0.31], [280, 0]);
  const holderO = useT(p, [0.2, 0.26], [0, 1]);
  // Layer 4: the table steps back so the phone can shine; layer 5: the stand moves aside for the plate
  const sceneO = useT(p, [0.58, 0.64, 0.79, 0.85], [1, 0.22, 0.22, 1]);
  const standX = useT(p, [0.81, 0.92], [0, -82]);

  // Layer 3 → 4 → 5: the hand with the phone
  const phoneX = useT(p, [0.39, 0.48, 0.6, 0.66, 0.8, 0.9], [360, 118, 118, 0, 0, 380]);
  const phoneY = useT(p, [0.39, 0.48, 0.6, 0.66, 0.8, 0.9], [380, -78, -78, -22, -22, -60]);
  const phoneR = useT(p, [0.39, 0.48, 0.6, 0.66, 0.8, 0.9], [28, -13, -13, 0, 0, 20]);
  const phoneS = useT(p, [0.6, 0.66, 0.8, 0.9], [1, 1.5, 1.5, 1.25]);
  const phoneO = useT(p, [0.38, 0.43, 0.84, 0.9], [0, 1, 1, 0]);
  const camO = useT(p, [0.43, 0.46, 0.6, 0.63], [0, 1, 1, 0]);
  const scanY = useT(p, [0.46, 0.555], [-46, 46]);
  const foundO = useT(p, [0.55, 0.57], [0, 1]);
  const menuO = useT(p, [0.6, 0.64], [0, 1]);
  // The moment of the scan: a ring goes out from the card
  const ringS = useT(p, [0.54, 0.6], [0.6, 1.9]);
  const ringO = useT(p, [0.54, 0.56, 0.6], [0, 0.9, 0]);

  // Layer 5: the plate lands
  const plateY = useT(p, [0.83, 0.93], [-460, 0]);
  const plateO = useT(p, [0.83, 0.87], [0, 1]);
  const shadowS = useT(p, [0.83, 0.93], [0.3, 1]);
  const steamO = useT(p, [0.92, 0.97], [0, 1]);

  return (
    <svg viewBox="0 0 600 600" className="w-full h-full max-w-[min(100%,62svh)] md:max-w-[600px] max-h-full overflow-visible select-none"
      role="img" aria-label="A QR code on a table stand is scanned with a phone, the menu opens, and a dish is served"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B27A4E" />
          <stop offset="0.55" stopColor="#8E5A35" />
          <stop offset="1" stopColor="#6B4026" />
        </linearGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9C7A2E" />
          <stop offset="0.3" stopColor="#F2D98A" />
          <stop offset="0.55" stopColor="#C9A24A" />
          <stop offset="1" stopColor="#8A6A25" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="screenDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B2F3A" />
          <stop offset="1" stopColor="#11131A" />
        </linearGradient>
        <linearGradient id="menuHead" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F28C5B" />
          <stop offset="1" stopColor="#E4572E" />
        </linearGradient>
        <radialGradient id="plate" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.8" stopColor="#F1ECE4" />
          <stop offset="1" stopColor="#D9D1C4" />
        </radialGradient>
        <clipPath id="screen"><rect x="-54" y="-112" width="108" height="224" rx="15" /></clipPath>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>

      <motion.g style={{ opacity: sceneO }}>
        {/* Table top, seen from slightly above */}
        <motion.g style={{ y: tableY, opacity: tableO }}>
          {/* Round table: edge band, then the top with grain and a soft shine */}
          <ellipse cx="300" cy="560" rx="318" ry="118" fill="#5A3420" />
          <ellipse cx="300" cy="546" rx="318" ry="116" fill="url(#wood)" />
          <ellipse cx="300" cy="546" rx="318" ry="116" fill="none" stroke="#D49A6A" strokeWidth="3" opacity="0.7" />
          {[0.82, 0.62, 0.42].map((k) => (
            <ellipse key={k} cx="300" cy="546" rx={318 * k} ry={116 * k} fill="none" stroke="#5A3420" strokeOpacity="0.18" strokeWidth="1.5" />
          ))}
          <ellipse cx="230" cy="500" rx="150" ry="34" fill="#fff" opacity="0.08" />
        </motion.g>

        <motion.g style={{ x: standX }}>
          {/* Holder: brass base and an arched glass frame */}
          <motion.g style={{ y: holderY, opacity: holderO }}>
            <ellipse cx="300" cy="466" rx="104" ry="13" fill="#000" opacity="0.22" filter="url(#soft)" />
            <path d="M222 455 L222 300 Q222 262 260 262 L340 262 Q378 262 378 300 L378 455 Z" fill="#fff" fillOpacity="0.28" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
          </motion.g>

          {/* The QR card (a real code: it opens the list of restaurants) */}
          <motion.g style={{ y: cardY, scale: cardS, rotate: cardR }}>
            <rect x="234" y="282" width="132" height="166" rx="12" fill="#000" opacity="0.18" transform="translate(4 6)" filter="url(#soft)" />
            <rect x="234" y="282" width="132" height="166" rx="12" fill="#FFFDF8" />
            <text x="300" y="303" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="2.5" fill="#1B1B1F">SCAN ME</text>
            <g transform="translate(252 312)"><path d={qr} fill="#1B1B1F" /></g>
            <motion.rect x="282" y="420" width="36" height="16" rx="8" style={{ fill: accent }} />
            <text x="300" y="431.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">MENU</text>
            {/* Scan ring */}
            <motion.rect x="234" y="282" width="132" height="166" rx="14" fill="none" stroke="#fff" strokeWidth="4" style={{ scale: ringS, opacity: ringO }} />
          </motion.g>

          {/* Holder front: brass base over the bottom of the card, glass shine on top */}
          <motion.g style={{ y: holderY, opacity: holderO }}>
            <path d="M226 300 Q226 266 260 266 L340 266 Q374 266 374 300 L374 452 L226 452 Z" fill="url(#glass)" opacity="0.55" pointerEvents="none" />
            <rect x="204" y="440" width="192" height="24" rx="8" fill="url(#brass)" />
            <rect x="204" y="440" width="192" height="5" rx="2.5" fill="#FFF3C4" opacity="0.7" />
            <rect x="214" y="462" width="172" height="8" rx="4" fill="#7A5A1E" />
            <text x="300" y="456" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="3" fill="#5C4313">TABLE 7</text>
          </motion.g>
        </motion.g>

        {/* The dish */}
        <motion.g style={{ opacity: plateO }}>
          <motion.ellipse cx="420" cy="512" rx="112" ry="24" fill="#000" opacity="0.28" filter="url(#soft)" style={{ scale: shadowS }} />
          <motion.g style={{ y: plateY }}>
            <Dish />
            <motion.g style={{ opacity: steamO }}>
              {[380, 420, 458].map((x, i) => (
                <path key={x} d={`M${x} 440 q-12 -22 0 -42 q12 -20 0 -42`} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.75"
                  className="landing-steam" style={{ animationDelay: `${i * 0.6}s` }} />
              ))}
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.g>

      {/* Hand holding the phone */}
      <motion.g style={{ x: phoneX, y: phoneY, rotate: phoneR, scale: phoneS, opacity: phoneO }}>
        <g transform="translate(300 300)">
          {/* Palm and wrist behind the phone */}
          <path d="M8 40 Q60 30 92 70 Q130 120 150 250 L40 290 Q20 200 -10 150 Q-30 110 8 40 Z" fill={SKIN} />
          <path d="M70 160 Q110 210 120 270 L150 250 Q138 170 110 120 Z" fill={SKIN_DARK} opacity="0.5" />
          <path d="M28 268 L156 226 L176 300 L48 344 Z" fill={SLEEVE} />
          <path d="M28 268 L156 226 L160 240 L32 282 Z" fill="#fff" opacity="0.18" />

          {/* Phone */}
          <rect x="-62" y="-124" width="124" height="248" rx="22" fill="#15171D" />
          <rect x="-60" y="-122" width="120" height="244" rx="20" fill="none" stroke="#3A3E4A" strokeWidth="1.5" />
          <g clipPath="url(#screen)">
            <rect x="-54" y="-112" width="108" height="224" fill="#F7F3EC" />
            {/* Camera view */}
            <motion.g style={{ opacity: camO }}>
              <rect x="-54" y="-112" width="108" height="224" fill="url(#screenDark)" />
              <g transform="translate(-30 -34) scale(0.625)">
                <rect x="-6" y="-6" width="108" height="108" rx="6" fill="#FFFDF8" />
                <path d={qr} fill="#1B1B1F" />
              </g>
              {[[-38, -50, 1, 1], [38, -50, -1, 1], [-38, 50, 1, -1], [38, 50, -1, -1]].map(([x, y, sx, sy], k) => (
                <path key={k} d={`M${x} ${y + 12 * sy} V${y} H${x + 12 * sx}`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              ))}
              <motion.rect x="-36" width="72" height="2.5" rx="1.25" fill="#7CF0A8" style={{ y: scanY }} />
              <rect x="-30" y="-96" width="60" height="16" rx="8" fill="#fff" fillOpacity="0.15" />
              <text x="0" y="-85" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff">Scanning…</text>
              <motion.g style={{ opacity: foundO }}>
                <rect x="-44" y="70" width="88" height="22" rx="11" fill="#7CF0A8" />
                <text x="0" y="84.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#0F2A1A">✓ Menu found</text>
              </motion.g>
            </motion.g>
            {/* The menu */}
            <motion.g style={{ opacity: menuO }}>
              <PhoneMenu p={p} />
            </motion.g>
          </g>
          <rect x="-16" y="-108" width="32" height="9" rx="4.5" fill="#15171D" />

          {/* Thumb and fingers over the edges */}
          <path d="M-74 66 Q-80 30 -58 8 Q-46 -2 -40 10 Q-38 30 -50 52 Q-58 74 -74 66 Z" fill={SKIN} />
          <path d="M-56 14 Q-48 6 -43 14" fill="none" stroke={SKIN_DARK} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          {[-18, 10, 38].map((y) => (
            <g key={y}>
              <rect x="50" y={y} width="30" height="24" rx="12" fill={SKIN} />
              <path d={`M56 ${y + 6} Q53 ${y + 12} 56 ${y + 18}`} fill="none" stroke={SKIN_DARK} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
            </g>
          ))}
        </g>
      </motion.g>

      {/* Little notes with lines, like a recipe sketch */}
      <Note p={p} at={[0.03, 0.16]} dot={[350, 238]} label={[392, 168]} title="A real code" sub="Try it with your camera" accent={accent} />
      <Note p={p} at={[0.32, 0.37]} dot={[206, 452]} label={[46, 392]} title="Brass table stand" sub="One code per table" accent={accent} />
      <Note p={p} at={[0.5, 0.57]} dot={[420, 132]} label={[452, 52]} title="No app needed" sub="Opens in under a second" accent={accent} />
      <ScansChart p={p} accent={accent} />
      <Note p={p} at={[0.94, 0.995]} dot={[456, 470]} label={[470, 560]} title="Rated 5★" sub="Right after the meal" accent={accent} />
    </svg>
  );
}

/** A plate of tagliatelle with tomatoes and basil */
function Dish() {
  return (
    <g>
      <ellipse cx="420" cy="500" rx="104" ry="34" fill="url(#plate)" />
      <ellipse cx="420" cy="496" rx="74" ry="23" fill="none" stroke="#E2DACC" strokeWidth="2" />
      <ellipse cx="420" cy="488" rx="58" ry="22" fill="#E9A23B" />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <path key={k} d={`M${372 + k * 4} ${486 + (k % 2) * 4} q24 ${-18 + k * 2} 48 0 q22 14 44 -2`} fill="none" stroke={k % 2 ? "#F6C969" : "#D8892B"} strokeWidth="5" strokeLinecap="round" />
      ))}
      <ellipse cx="420" cy="478" rx="30" ry="10" fill="#F3BF5C" opacity="0.9" />
      {[[396, 478], [440, 472], [424, 492], [454, 488], [388, 494]].map(([x, y], k) => (
        <g key={k}>
          <circle cx={x} cy={y} r="8" fill="#D93A2B" />
          <circle cx={x - 2.5} cy={y - 2.5} r="2.2" fill="#fff" opacity="0.6" />
        </g>
      ))}
      <path d="M410 466 q10 -14 22 -4 q-10 10 -22 4 Z" fill="#3E9B4F" />
      <path d="M418 468 q-14 -12 -22 0 q12 8 22 0 Z" fill="#2F7F3E" />
      <circle cx="430" cy="462" r="1.8" fill="#fff" opacity="0.8" />
    </g>
  );
}

/** The menu on the phone screen */
function PhoneMenu({ p }: { p: MotionValue<number> }) {
  const rows = [
    { name: "Tagliatelle", note: "Tomato · basil", price: "€12", color: "#E9A23B" },
    { name: "Burrata", note: "Peach · honey", price: "€9", color: "#F4C7AB" },
    { name: "Sea bass", note: "Lemon · herbs", price: "€18", color: "#BFD3BA" },
  ];
  return (
    <g>
      <rect x="-54" y="-112" width="108" height="224" fill="#F7F3EC" />
      <rect x="-54" y="-112" width="108" height="66" fill="url(#menuHead)" />
      <circle cx="30" cy="-84" r="22" fill="#fff" opacity="0.18" />
      <text x="-44" y="-74" fontSize="12" fontWeight="800" fill="#fff" style={{ fontFamily: "var(--font-display), serif" }}>Bella Vista</text>
      <text x="-44" y="-62" fontSize="6.5" fill="#fff" opacity="0.9">Table 7 · Open now</text>
      {["Starters", "Mains", "Sweet"].map((t, k) => (
        <g key={t}>
          <rect x={-46 + k * 32} y="-38" width="29" height="12" rx="6" fill={k === 1 ? "#1B1B1F" : "#fff"} stroke="#E5DED2" />
          <text x={-31.5 + k * 32} y="-29.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill={k === 1 ? "#fff" : "#55504A"}>{t}</text>
        </g>
      ))}
      {rows.map((r, k) => <MenuRow key={r.name} p={p} k={k} r={r} />)}
      <rect x="-46" y="88" width="92" height="16" rx="8" fill="#1B1B1F" />
      <text x="0" y="98.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#fff">Call the waiter</text>
    </g>
  );
}

function MenuRow({ p, k, r }: { p: MotionValue<number>; k: number; r: { name: string; note: string; price: string; color: string } }) {
  const o = useTransform(p, [0.62 + k * 0.025, 0.65 + k * 0.025], [0, 1]);
  const x = useTransform(p, [0.62 + k * 0.025, 0.65 + k * 0.025], [14, 0]);
  const y = -18 + k * 34;
  return (
    <motion.g style={{ opacity: o, x }}>
      <rect x="-48" y={y} width="96" height="30" rx="8" fill="#fff" />
      <circle cx="-34" cy={y + 15} r="10" fill={r.color} />
      <circle cx="-37" cy={y + 12} r="3" fill="#fff" opacity="0.5" />
      <text x="-20" y={y + 13} fontSize="7" fontWeight="700" fill="#1B1B1F">{r.name}</text>
      <text x="-20" y={y + 22} fontSize="5.5" fill="#8A847C">{r.note}</text>
      <text x="42" y={y + 18} textAnchor="end" fontSize="7.5" fontWeight="800" fill="#E4572E">{r.price}</text>
    </motion.g>
  );
}

/** A small label with a line to what it describes */
function Note({ p, at, dot, label, title, sub, accent }: {
  p: MotionValue<number>; at: [number, number]; dot: [number, number]; label: [number, number];
  title: string; sub: string; accent: MotionValue<string>;
}) {
  const [a, b] = at;
  const o = useTransform(p, [a, a + 0.025, b - 0.02, b], [0, 1, 1, a > 0.9 ? 1 : 0]);
  const draw = useTransform(p, [a, a + 0.03], [0, 1]);
  const w = Math.max(title.length * 6.6, sub.length * 5.1) + 22;
  const [lx, ly] = label;
  // The line ends at the edge of the label nearest the dot
  const ex = dot[0] < lx ? lx : dot[0] > lx + w ? lx + w : dot[0];
  const ey = dot[1] < ly ? ly : ly + 36;
  return (
    <motion.g style={{ opacity: o }}>
      <motion.path d={`M${dot[0]} ${dot[1]} L${ex} ${ey}`} fill="none" stroke="currentColor" strokeWidth="1.5" style={{ pathLength: draw }} />
      <motion.circle cx={dot[0]} cy={dot[1]} r="5" style={{ fill: accent }} />
      <circle cx={dot[0]} cy={dot[1]} r="9" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x={lx} y={ly} width={w} height="36" rx="18" fill="#fff" fillOpacity="0.85" />
      <text x={lx + 12} y={ly + 15} fontSize="11" fontWeight="700" fill="#1B1B1F">{title}</text>
      <text x={lx + 12} y={ly + 28} fontSize="9" fill="#55504A">{sub}</text>
    </motion.g>
  );
}

/** Layer 4: weekly scans growing next to the phone */
function ScansChart({ p, accent }: { p: MotionValue<number>; accent: MotionValue<string> }) {
  const o = useTransform(p, [0.63, 0.66, 0.78, 0.81], [0, 1, 1, 0]);
  const bars = [34, 52, 41, 66, 58, 84, 74];
  return (
    <motion.g style={{ opacity: o }}>
      <g transform="translate(418 64)">
        <rect width="168" height="128" rx="16" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.25" />
        <text x="14" y="22" fontSize="10" fontWeight="600" fill="currentColor" opacity="0.8">Scans this week</text>
        <text x="14" y="42" fontSize="18" fontWeight="800" fill="currentColor">1,247</text>
        <motion.text x="86" y="42" fontSize="10" fontWeight="800" style={{ fill: accent }}>▲ 32%</motion.text>
        {bars.map((h, k) => <Bar key={k} p={p} k={k} h={h} accent={accent} />)}
      </g>
      <g transform="translate(418 210)">
        <rect width="132" height="40" rx="20" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.25" />
        <text x="16" y="25" fontSize="11" fontWeight="700" fill="currentColor">★ 4.9 dish rating</text>
      </g>
      <g transform="translate(14 120)">
        <rect width="132" height="40" rx="20" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.25" />
        <text x="16" y="25" fontSize="11" fontWeight="700" fill="currentColor">Live in 3 seconds</text>
      </g>
    </motion.g>
  );
}

function Bar({ p, k, h, accent }: { p: MotionValue<number>; k: number; h: number; accent: MotionValue<string> }) {
  const s = useTransform(p, [0.64 + k * 0.012, 0.69 + k * 0.012], [0, 1]);
  const height = useTransform(s, (v) => (h * 0.62) * v);
  const y = useTransform(height, (v) => 116 - v);
  return <motion.rect x={14 + k * 21} width="14" rx="4" height={height} y={y} style={{ fill: k === 5 ? accent : "currentColor", opacity: k === 5 ? 1 : 0.45 }} />;
}
