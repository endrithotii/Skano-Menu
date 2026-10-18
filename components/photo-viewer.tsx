"use client";

// Full-screen photos: normal photos and 360 photos (drag to look around, pinch or wheel to zoom).
// three.js is only loaded when a 360 photo is opened.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Move3d, Loader2 } from "lucide-react";

export interface ViewerPhoto { url: string; kind: "photo" | "360"; caption?: string }

export function PhotoViewer({ photos, start = 0, title, onClose }: { photos: ViewerPhoto[]; start?: number; title?: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const p = photos[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && p?.kind !== "360") setI((v) => Math.min(photos.length - 1, v + 1));
      if (e.key === "ArrowLeft" && p?.kind !== "360") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, photos.length, p?.kind]);
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={title ?? "Photos"} data-photo-viewer>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          {title && <div className="text-sm font-semibold truncate">{title}</div>}
          <div className="text-xs text-white/60">{p.caption ?? (p.kind === "360" ? "360° view" : "Photo")}{photos.length > 1 ? ` · ${i + 1} of ${photos.length}` : ""}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-white/10 hover:bg-white/20"><X className="w-5 h-5" /></button>
      </div>
      <div className="relative flex-1 min-h-0">
        {p.kind === "360" ? <Pano key={p.url} url={p.url} /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.url} alt={p.caption ?? ""} className="absolute inset-0 w-full h-full object-contain" />
        )}
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
            <button type="button" onClick={() => setI((v) => Math.min(photos.length - 1, v + 1))} disabled={i === photos.length - 1} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 justify-center px-4 py-3 overflow-x-auto">
          {photos.map((x, j) => (
            <button key={x.url} type="button" onClick={() => setI(j)} aria-label={`Photo ${j + 1}`} className={`relative shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 ${j === i ? "border-white" : "border-transparent opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="" className="w-full h-full object-cover" />
              {x.kind === "360" && <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/70 text-white px-1 rounded-tl">360</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A 360 photo on the inside of a sphere */
function Pano({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let stop = false;
    let cleanup = () => {};
    void (async () => {
      const THREE = await import("three");
      if (stop) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = "none";
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1100);
      const geo = new THREE.SphereGeometry(500, 60, 40);
      geo.scale(-1, 1, 1);
      const texture = await new THREE.TextureLoader().loadAsync(url).catch(() => null);
      if (stop) { renderer.dispose(); return; }
      if (!texture) { setState("error"); renderer.domElement.remove(); renderer.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
      scene.add(mesh);
      setState("ready");

      let lon = 0, lat = 0, auto = true, raf = 0;
      let drag: { x: number; y: number; lon: number; lat: number } | null = null;
      const pointers = new Map<number, { x: number; y: number }>();
      let pinch = 0;
      const draw = () => {
        if (auto) lon += 0.04;
        lat = Math.max(-85, Math.min(85, lat));
        const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
        renderer.render(scene, camera);
        raf = requestAnimationFrame(draw);
      };
      draw();
      const zoom = (d: number) => { camera.fov = Math.max(35, Math.min(95, camera.fov + d)); camera.updateProjectionMatrix(); };
      const down = (e: PointerEvent) => {
        auto = false; setHint(false);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        renderer.domElement.setPointerCapture(e.pointerId);
        if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, lon, lat };
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
      };
      const move = (e: PointerEvent) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          zoom((pinch - d) * 0.1); pinch = d; return;
        }
        if (!drag) return;
        const k = camera.fov / el.clientHeight;
        lon = drag.lon - (e.clientX - drag.x) * k;
        lat = drag.lat + (e.clientY - drag.y) * k;
      };
      const up = (e: PointerEvent) => { pointers.delete(e.pointerId); if (!pointers.size) drag = null; };
      const wheel = (e: WheelEvent) => { e.preventDefault(); auto = false; zoom(e.deltaY * 0.03); };
      const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); };
      const c = renderer.domElement;
      c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
      c.addEventListener("wheel", wheel, { passive: false });
      window.addEventListener("resize", resize);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        texture.dispose(); geo.dispose(); (mesh.material as { dispose: () => void }).dispose(); renderer.dispose(); c.remove();
      };
    })();
    return () => { stop = true; cleanup(); };
  }, [url]);

  return (
    <div ref={box} className="absolute inset-0 cursor-grab active:cursor-grabbing" data-pano={state}>
      {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="w-7 h-7 animate-spin" /></div>}
      {state === "error" && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">This 360 photo could not be shown.</div>}
      {state === "ready" && hint && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-black/60 text-white text-xs px-3 py-1.5"><Move3d className="w-4 h-4" /> Drag to look around</div>
      )}
    </div>
  );
}
