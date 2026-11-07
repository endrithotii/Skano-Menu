// The 3D scene behind the landing page story (plain three.js, no React).
// A black marble table, a brass stand with a glass plate holding a QR card, a phone seen from
// the guest's point of view that scans the card (its screen shows what its own camera sees),
// the menu on that phone, and a plate of tagliatelle with a glass of red wine.
// update(p) moves everything for scroll progress p (0..1).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import QRCode from "qrcode";

// ── Small helpers ───────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before a, 1 after b, eased in between */
const ease = (p: number, a: number, b: number) => {
  const t = clamp01((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Seeded random so the marble and the pasta look the same on every visit */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ── Textures drawn on canvases ──────────────────────────────────────────────

function marbleTexture() {
  const { c, g } = canvas(1024, 1024);
  const r = rng(7);
  const base = g.createRadialGradient(512, 512, 80, 512, 512, 720);
  base.addColorStop(0, "#1d1d21");
  base.addColorStop(1, "#0d0d10");
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1024);
  // Cloudy depth
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.015})`;
    g.beginPath();
    g.ellipse(r() * 1024, r() * 1024, 60 + r() * 220, 20 + r() * 90, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Veins: long wandering strokes, some warm gold, most pale grey
  const vein = (w: number, a: number, gold: boolean) => {
    g.strokeStyle = gold ? `rgba(214,178,112,${a})` : `rgba(235,232,226,${a})`;
    g.lineWidth = w;
    g.beginPath();
    let x = r() * 1024, y = r() * 1024, ang = r() * Math.PI * 2;
    g.moveTo(x, y);
    for (let s = 0; s < 40; s++) {
      ang += (r() - 0.5) * 0.7;
      x += Math.cos(ang) * 30; y += Math.sin(ang) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  };
  g.filter = "blur(3px)";
  for (let i = 0; i < 14; i++) vein(6 + r() * 10, 0.05, false);
  g.filter = "blur(0.6px)";
  for (let i = 0; i < 26; i++) vein(0.8 + r() * 1.6, 0.18 + r() * 0.25, r() < 0.35);
  g.filter = "none";
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function qrCardTexture(url: string, serif: string) {
  const W = 768, H = 1024;
  const { c, g } = canvas(W, H);
  // Thick cream paper with a soft fibre texture
  g.fillStyle = "#FBF7EF";
  g.fillRect(0, 0, W, H);
  const r = rng(3);
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(120,100,70,${r() * 0.035})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
  }
  // Gold frame line
  g.strokeStyle = "#B08A4A";
  g.lineWidth = 3;
  roundRect(g, 34, 34, W - 68, H - 68, 18);
  g.stroke();
  g.fillStyle = "#191714";
  g.textAlign = "center";
  g.font = `600 50px ${serif}`;
  g.fillText("Bella Vista", W / 2, 126);
  g.fillStyle = "#B08A4A";
  g.fillRect(W / 2 - 46, 152, 92, 3);
  g.fillStyle = "#6B6258";
  g.font = "600 24px system-ui, sans-serif";
  g.fillText("S C A N   F O R   T H E   M E N U", W / 2, 206);
  // The QR code (real: it opens the list of restaurants)
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const size = 470, m = size / n, ox = (W - size) / 2, oy = 250;
  g.fillStyle = "#191714";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (qr.modules.get(x, y)) g.fillRect(ox + x * m, oy + y * m, m + 0.4, m + 0.4);
  }
  g.font = `italic 400 64px ${serif}`;
  g.fillStyle = "#191714";
  g.fillText("Table 7", W / 2, 848);
  g.fillStyle = "#8C8277";
  g.font = "600 22px system-ui, sans-serif";
  g.fillText("N O   A P P   N E E D E D", W / 2, 902);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Rounded-corner mask for the phone screen */
function screenMask() {
  const { c, g } = canvas(256, 552);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 552);
  g.fillStyle = "#fff";
  roundRect(g, 0, 0, 256, 552, 34);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

function drawFoodThumb(g: CanvasRenderingContext2D, x: number, y: number, r: number, kind: number) {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  const plate = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  plate.addColorStop(0, "#ffffff"); plate.addColorStop(1, "#ddd6ca");
  g.fillStyle = plate; g.fillRect(x - r, y - r, r * 2, r * 2);
  const rr = rng(11 + kind);
  if (kind === 0) {
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = i % 2 ? "#E8B65A" : "#D59A3A"; g.lineWidth = 4;
      g.beginPath(); g.arc(x + (rr() - 0.5) * 14, y + (rr() - 0.5) * 14, r * (0.25 + rr() * 0.35), rr() * 6, rr() * 6 + 2.5); g.stroke();
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = "#C9302A"; g.beginPath(); g.arc(x + (rr() - 0.5) * r, y + (rr() - 0.5) * r, 6, 0, 7); g.fill(); }
    g.fillStyle = "#3C8A45"; g.beginPath(); g.ellipse(x + 4, y - 6, 9, 5, 0.6, 0, 7); g.fill();
  } else if (kind === 1) {
    g.fillStyle = "#F6F1E7"; g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill();
    g.fillStyle = "#EFA56C"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + Math.cos(i * 1.3) * r * 0.62, y + Math.sin(i * 1.3) * r * 0.62, 9, 6, i, 0, 7); g.fill(); }
    g.fillStyle = "#6E9F4F"; g.beginPath(); g.ellipse(x - 6, y - 4, 7, 4, 0.4, 0, 7); g.fill();
  } else {
    g.fillStyle = "#E9E3D6"; g.beginPath(); g.ellipse(x, y, r * 0.7, r * 0.42, -0.3, 0, 7); g.fill();
    g.strokeStyle = "#C8B79A"; g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 10 - 8, y - 12); g.lineTo(x + i * 10 + 8, y + 12); g.stroke(); }
    g.fillStyle = "#F2E05A"; g.beginPath(); g.ellipse(x + r * 0.55, y + r * 0.3, 8, 5, 0.3, 0, 7); g.fill();
  }
  g.restore();
}

function menuTexture(serif: string) {
  const W = 512, H = 1104;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#F7F2EA";
  g.fillRect(0, 0, W, H);
  // Header: a warm "photo" of the dining room light
  const head = g.createLinearGradient(0, 0, W, 330);
  head.addColorStop(0, "#3A2A20"); head.addColorStop(0.55, "#7A4A2C"); head.addColorStop(1, "#C27A44");
  g.fillStyle = head; g.fillRect(0, 0, W, 330);
  const r = rng(5);
  for (let i = 0; i < 18; i++) {
    const x = r() * W, y = 40 + r() * 240, rad = 6 + r() * 26;
    const b = g.createRadialGradient(x, y, 0, x, y, rad);
    b.addColorStop(0, "rgba(255,214,150,0.55)"); b.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = b; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  const fade = g.createLinearGradient(0, 180, 0, 330);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = fade; g.fillRect(0, 180, W, 150);
  g.fillStyle = "#fff";
  g.font = `600 52px ${serif}`;
  g.fillText("Bella Vista", 36, 270);
  g.font = "500 20px system-ui, sans-serif";
  g.globalAlpha = 0.85; g.fillText("Table 7  ·  Open until 23:00", 38, 306); g.globalAlpha = 1;
  // Tabs
  ["Starters", "Mains", "Desserts", "Wine"].forEach((t, i) => {
    const x = 28 + i * 118, active = i === 1;
    g.fillStyle = active ? "#191714" : "#fff";
    roundRect(g, x, 360, 108, 48, 24); g.fill();
    if (!active) { g.strokeStyle = "#E4DCCF"; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = active ? "#fff" : "#5B544B";
    g.font = "600 19px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(t, x + 54, 391); g.textAlign = "left";
  });
  const dishes = [
    { n: "Tagliatelle al pomodoro", d: "San Marzano, basil, parmigiano", p: "€14" },
    { n: "Burrata & peach", d: "Honey, mint, olive oil", p: "€11" },
    { n: "Sea bass", d: "Lemon, capers, herbs", p: "€22" },
  ];
  dishes.forEach((x, i) => {
    const y = 440 + i * 170;
    g.fillStyle = "#fff";
    roundRect(g, 24, y, W - 48, 150, 26); g.fill();
    drawFoodThumb(g, 100, y + 75, 56, i);
    g.fillStyle = "#191714";
    g.font = `600 27px ${serif}`;
    g.fillText(x.n.length > 18 ? x.n.slice(0, 17) + "…" : x.n, 178, y + 62);
    g.fillStyle = "#8A8178";
    g.font = "400 18px system-ui, sans-serif";
    g.fillText(x.d, 178, y + 94);
    g.fillStyle = "#A8763E";
    g.font = "700 24px system-ui, sans-serif";
    g.fillText(x.p, 178, y + 128);
    g.fillStyle = "#F1C14B";
    g.font = "600 18px system-ui, sans-serif";
    g.fillText("★ 4.9", 404, y + 128);
  });
  g.fillStyle = "#191714";
  roundRect(g, 32, 980, W - 64, 76, 38); g.fill();
  g.fillStyle = "#fff"; g.font = "600 24px system-ui, sans-serif"; g.textAlign = "center";
  g.fillText("Call the waiter", W / 2, 1027);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function steamTexture() {
  const { c, g } = canvas(128, 256);
  const grd = g.createRadialGradient(64, 150, 4, 64, 150, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 256);
  return new THREE.CanvasTexture(c);
}

// ── Objects ─────────────────────────────────────────────────────────────────

const TABLE_R = 0.62;

function makeTable(isMobile: boolean) {
  const map = marbleTexture();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshPhysicalMaterial({
    map, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const R = TABLE_R;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.04, isMobile ? 64 : 128), mat);
  top.position.y = -0.02;
  top.receiveShadow = true;
  const brass = new THREE.MeshStandardMaterial({ color: "#C9A25A", metalness: 1, roughness: 0.26 });
  // A thin brass band around the edge
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.012, isMobile ? 64 : 128, 1, true), brass);
  band.position.y = -0.034;
  // Pedestal: a brass column going down out of view
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.4, 32), brass);
  leg.position.y = -0.74;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.03, 48), brass);
  collar.position.y = -0.055;
  const g = new THREE.Group();
  g.add(top, band, leg, collar);
  return g;
}

function makeStand() {
  const brass = new THREE.MeshStandardMaterial({ color: "#D4AF67", metalness: 1, roughness: 0.22 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.035, 0.11, 4, 0.012), brass);
  base.position.y = 0.0175;
  base.castShadow = true;
  base.receiveShadow = true;
  // Slot line on the base
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.002, 0.016), new THREE.MeshStandardMaterial({ color: "#3C2E14", metalness: 0.6, roughness: 0.5 }));
  slot.position.set(0, 0.0352, 0);
  // Glass plate the card sits in
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(0.26, 0.345, 0.012, 4, 0.006),
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff", metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.012, ior: 1.5,
      transparent: true, opacity: 1, clearcoat: 1, clearcoatRoughness: 0.02,
    }),
  );
  glass.position.set(0, 0.035 + 0.1725, 0);
  glass.castShadow = true;
  const g = new THREE.Group();
  g.add(base, slot, glass);
  return g;
}

function makeCard(map: THREE.Texture) {
  const paper = new THREE.MeshStandardMaterial({ color: "#F6F1E7", roughness: 0.9 });
  const front = new THREE.MeshStandardMaterial({ map, roughness: 0.75 });
  // Box faces: +x, -x, +y, -y, +z (front), -z
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.3, 0.003), [paper, paper, paper, paper, front, paper]);
  card.castShadow = true;
  return card;
}

function makePhone(screenMap: THREE.Texture, mask: THREE.Texture) {
  const W = 0.0716, H = 0.1546, D = 0.0083;
  const g = new THREE.Group();
  const titanium = new THREE.MeshStandardMaterial({ color: "#A7A39C", metalness: 1, roughness: 0.32 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.0095), titanium);
  body.castShadow = true;
  g.add(body);
  // Black glass front
  const front = new THREE.Mesh(
    new RoundedBoxGeometry(W - 0.0012, H - 0.0012, 0.0006, 4, 0.0092),
    new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.05, metalness: 0, clearcoat: 1 }),
  );
  front.position.z = D / 2 - 0.0002;
  g.add(front);
  // Back glass with a camera bump
  const back = new THREE.Mesh(
    new RoundedBoxGeometry(W - 0.0012, H - 0.0012, 0.0006, 4, 0.0092),
    new THREE.MeshPhysicalMaterial({ color: "#C9C2B6", roughness: 0.45, metalness: 0.1, clearcoat: 0.6 }),
  );
  back.position.z = -D / 2 + 0.0002;
  g.add(back);
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.031, 0.031, 0.002, 4, 0.007), new THREE.MeshPhysicalMaterial({ color: "#BDB5A8", roughness: 0.3, metalness: 0.3, clearcoat: 1 }));
  bump.position.set(-W / 2 + 0.019, H / 2 - 0.019, -D / 2 - 0.001);
  g.add(bump);
  for (const [x, y] of [[-0.007, 0.007], [0.007, -0.002], [-0.007, -0.009]]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.002, 32), new THREE.MeshPhysicalMaterial({ color: "#0B0C10", roughness: 0.05, metalness: 0.5, clearcoat: 1 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(bump.position.x + x, bump.position.y + y, -D / 2 - 0.0025);
    g.add(lens);
  }
  // Screen layers: live camera view, scanner overlay, menu
  const sw = W - 0.0046, sh = H - 0.0046;
  const layer = (map: THREE.Texture | null, z: number, transparent = true) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ map, alphaMap: mask, transparent, toneMapped: false, depthWrite: false }),
    );
    m.position.z = D / 2 + z;
    g.add(m);
    return m;
  };
  const camLayer = layer(null, 0.0002);
  const uiLayer = layer(screenMap, 0.0003);
  const menuLayer = layer(null, 0.0004);
  // Dynamic island
  const island = new THREE.Mesh(new RoundedBoxGeometry(0.019, 0.0055, 0.0004, 3, 0.0027), new THREE.MeshBasicMaterial({ color: "#000" }));
  island.position.set(0, H / 2 - 0.0075, D / 2 + 0.0006);
  g.add(island);
  return { group: g, camLayer, uiLayer, menuLayer, W, H };
}

function makeDish(isMobile: boolean) {
  const g = new THREE.Group();
  // Wide-rim porcelain plate, turned on a lathe
  const prof = [
    [0, 0.004], [0.085, 0.004], [0.095, 0.006], [0.1, 0.014], [0.104, 0.018], [0.15, 0.024], [0.158, 0.026], [0.16, 0.022],
    [0.152, 0.018], [0.11, 0.008], [0.09, 0.0], [0.0, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const plate = new THREE.Mesh(
    new THREE.LatheGeometry(prof, isMobile ? 64 : 128),
    new THREE.MeshPhysicalMaterial({ color: "#FBFAF7", roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
  );
  plate.castShadow = true;
  plate.receiveShadow = true;
  g.add(plate);
  // A nest of tagliatelle: flat ribbons twisting around the middle
  const r = rng(21);
  const pastaMat = new THREE.MeshPhysicalMaterial({ color: "#E8B357", roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color("#FFE2A0") });
  const strands = isMobile ? 26 : 44;
  for (let i = 0; i < strands; i++) {
    const pts: THREE.Vector3[] = [];
    const a0 = r() * Math.PI * 2, turns = 1 + r() * 0.9, rad = 0.025 + r() * 0.04;
    const h0 = 0.012 + r() * 0.02;
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, a = a0 + t * turns * Math.PI * 2;
      const rr = rad * (0.65 + 0.35 * Math.sin(t * Math.PI)) + (r() - 0.5) * 0.004;
      pts.push(v3(Math.cos(a) * rr, h0 + Math.sin(t * Math.PI) * (0.018 + r() * 0.02) + (r() - 0.5) * 0.004, Math.sin(a) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0032, 5, false), pastaMat);
    tube.scale.set(1, 1, 1);
    tube.castShadow = true;
    g.add(tube);
  }
  // Sauce glaze in the middle
  const sauce = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: "#B4321F", roughness: 0.25, clearcoat: 1, transparent: true, opacity: 0.85 }),
  );
  sauce.scale.set(1, 0.35, 1);
  sauce.position.y = 0.012;
  g.add(sauce);
  // Cherry tomatoes
  const tomato = new THREE.MeshPhysicalMaterial({ color: "#D2281C", roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const [x, y, z, s] of [[0.03, 0.05, 0.012, 1], [-0.028, 0.046, -0.018, 0.9], [0.006, 0.055, -0.034, 0.85], [-0.04, 0.035, 0.03, 0.95], [0.05, 0.03, -0.03, 0.8]]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.0115 * s, 24, 16), tomato);
    t.scale.y = 0.88;
    t.position.set(x, y, z);
    t.castShadow = true;
    g.add(t);
  }
  // Basil leaves
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.012, 0.012, 0, 0.034);
  leafShape.quadraticCurveTo(-0.012, 0.012, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  const leafMat = new THREE.MeshPhysicalMaterial({ color: "#2F7A34", roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide });
  for (const [x, z, rot] of [[0.0, 0.0, 0.4], [0.008, -0.006, 2.4], [-0.006, 0.004, 4.4]]) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, 0.062, z);
    leaf.rotation.set(-Math.PI / 2 + 0.35, 0, rot);
    g.add(leaf);
  }
  // Parmigiano shavings
  const cheese = new THREE.MeshStandardMaterial({ color: "#F4E7C2", roughness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0008, 0.006), cheese);
    s.position.set((r() - 0.5) * 0.07, 0.045 + r() * 0.015, (r() - 0.5) * 0.07);
    s.rotation.set(r(), r() * 3, r());
    g.add(s);
  }
  return g;
}

function makeWineGlass(isMobile: boolean) {
  const seg = isMobile ? 48 : 96;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.02, transmission: 1, thickness: 0.003, ior: 1.5, transparent: true, side: THREE.DoubleSide,
  });
  const prof = [
    [0.0, 0.0], [0.038, 0.0], [0.04, 0.002], [0.006, 0.006], [0.004, 0.012], [0.004, 0.11], [0.012, 0.118],
    [0.034, 0.135], [0.045, 0.17], [0.043, 0.21], [0.036, 0.235], [0.035, 0.236],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, seg), glassMat);
  glass.castShadow = true;
  const wineProf = [[0.0, 0.122], [0.012, 0.122], [0.032, 0.137], [0.04, 0.165], [0.0, 0.165]].map(([x, y]) => new THREE.Vector2(x, y));
  const wine = new THREE.Mesh(
    new THREE.LatheGeometry(wineProf, seg),
    new THREE.MeshPhysicalMaterial({ color: "#6B0F22", roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.3, sheenColor: new THREE.Color("#C4304A") }),
  );
  wine.renderOrder = 1;
  glass.renderOrder = 2;
  const g = new THREE.Group();
  g.add(wine, glass);
  return g;
}

// ── The scene ───────────────────────────────────────────────────────────────

export type SceneHandle = { update: (p: number) => void; resize: (w: number, h: number) => void; dispose: () => void; setRunning: (on: boolean) => void };

export function createTableScene(host: HTMLElement, opts: { qrUrl: string; serif: string }): SceneHandle {
  const isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.6;

  // Warm key light with soft shadows, cool fill, and a rim light from behind
  const key = new THREE.DirectionalLight("#FFE9CF", 2.6);
  key.position.set(-1.2, 2.4, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  key.shadow.camera.left = -0.9; key.shadow.camera.right = 0.9;
  key.shadow.camera.top = 0.9; key.shadow.camera.bottom = -0.9;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 6;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#D7E3FF", 0.6);
  fill.position.set(1.6, 1.0, 1.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight("#FFFFFF", 1.4);
  rim.position.set(0.4, 1.6, -2.2);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);

  // Objects
  const table = makeTable(isMobile);
  scene.add(table);
  const stand = makeStand();
  scene.add(stand);
  const card = makeCard(qrCardTexture(opts.qrUrl, opts.serif));
  scene.add(card);
  const dish = makeDish(isMobile);
  scene.add(dish);
  const wine = makeWineGlass(isMobile);
  wine.position.set(-0.3, 0, -0.2);
  scene.add(wine);

  // Scanner overlay drawn on a canvas each frame while scanning
  const ui = canvas(256, 552);
  const uiTex = new THREE.CanvasTexture(ui.c);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  const mask = screenMask();
  const phone = makePhone(uiTex, mask);
  scene.add(phone.group);
  const menuTex = menuTexture(opts.serif);
  (phone.menuLayer.material as THREE.MeshBasicMaterial).map = menuTex;

  // What the phone's own camera sees, rendered into a texture for its screen
  const rt = new THREE.WebGLRenderTarget(isMobile ? 360 : 512, isMobile ? 776 : 1104, { colorSpace: THREE.SRGBColorSpace, samples: 2 });
  (phone.camLayer.material as THREE.MeshBasicMaterial).map = rt.texture;
  const phoneCam = new THREE.PerspectiveCamera(46, phone.W / phone.H, 0.01, 20);

  // Steam above the dish
  const steamTex = steamTexture();
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.set(0.08, 0.16, 1);
    scene.add(s);
    steam.push(s);
  }

  // Where things are: the card in its stand, the dish next to it
  const CARD_IN_STAND = v3(0, 0.035 + 0.006 + 0.15, 0.0075);
  const DISH_AT = v3(0.3, 0, 0.14);

  let progress = 0;
  let sized = false;
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const tmpQ = new THREE.Quaternion();
  const look = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running || !sized) return;
    const t = clock.getElapsedTime();
    const p = progress;

    // ── Camera path ──
    // 1 close on the floating card · 2 pull back to the table · 3 behind the guest's phone · 4 the phone fills the view · 5 the served table
    const camKeys: [number, THREE.Vector3, THREE.Vector3][] = [
      [0.0, v3(0, 0.98, 0.95), v3(0, 0.98, 0)],
      [0.16, v3(0, 0.98, 0.95), v3(0, 0.98, 0)],
      [0.34, v3(0.78, 1.0, 1.95), v3(0.0, 0.06, 0)],
      [0.42, v3(0.78, 1.0, 1.95), v3(0.0, 0.06, 0)],
      [0.5, v3(0.12, 0.62, 1.2), v3(0, 0.17, 0)],
      [0.6, v3(0.12, 0.62, 1.2), v3(0, 0.17, 0)],
      [0.8, v3(0.12, 0.62, 1.2), v3(0, 0.17, 0)],
      [0.92, v3(0.75, 1.0, 1.85), v3(0.04, 0.06, 0)],
      [1.0, v3(0.8, 0.98, 1.8), v3(0.04, 0.06, 0)],
    ];
    let i = 0;
    while (i < camKeys.length - 2 && p > camKeys[i + 1][0]) i++;
    const [pa, ca, la] = camKeys[i], [pb, cb, lb] = camKeys[i + 1];
    const k = ease(p, pa, pb);
    camera.position.lerpVectors(ca, cb, k);
    look.lerpVectors(la, lb, k);
    // A slow breathing drift so it never feels frozen
    camera.position.x += Math.sin(t * 0.35) * 0.012;
    camera.position.y += Math.sin(t * 0.27) * 0.008;
    camera.lookAt(look);

    // ── Card: floats and turns, then drops into the stand ──
    const drop = ease(p, 0.17, 0.33);
    const floatPos = v3(0, 0.98 + Math.sin(t * 1.1) * 0.012, 0);
    card.position.lerpVectors(floatPos, CARD_IN_STAND, drop);
    card.rotation.set(
      lerp(-0.12 + Math.sin(t * 0.8) * 0.04, 0, drop),
      lerp(Math.sin(t * 0.6) * 0.45 - 0.2, 0, drop),
      lerp(-0.06, 0, drop),
    );
    // The stand rises out of the table a moment before the card lands
    const standIn = ease(p, 0.15, 0.27);
    stand.position.y = lerp(-0.4, 0, standIn);
    stand.visible = standIn > 0.001;

    // ── Phone ──
    // Held below the eye, its back camera on the card; then lifted to face the guest; then put away
    // Offsets in the camera's own directions (right, up, forward)
    const fwd = look.clone().sub(camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const at = (r: number, u: number, f: number) =>
      camera.position.clone().addScaledVector(right, r).addScaledVector(up, u).addScaledVector(fwd, f);
    const portrait = camera.aspect < 0.8;
    const scanPos = at(portrait ? 0.03 : 0.035, -0.04, 0.5);
    const enter = ease(p, 0.42, 0.5);
    const lift = ease(p, 0.6, 0.68);
    const away = ease(p, 0.8, 0.88);
    const startPos = at(0.16, -0.32, 0.3);
    const facePos = at(0, 0, portrait ? 0.3 : 0.36);
    const awayPos = at(0.4, -0.3, 0.32);
    const pos = startPos.clone().lerp(scanPos, enter).lerp(facePos, lift).lerp(awayPos, away);
    phone.group.position.copy(pos);
    phone.group.visible = enter > 0.001 && away < 0.999;
    // Scanning: the back faces the card (tilted like a hand holds it). Facing: the screen faces the eye.
    const scanQ = new THREE.Quaternion();
    {
      const m = new THREE.Matrix4().lookAt(pos, CARD_IN_STAND, v3(0, 1, 0));
      scanQ.setFromRotationMatrix(m);
      tmpQ.setFromEuler(new THREE.Euler(0.12, 0.15, -0.16));
      scanQ.multiply(tmpQ);
    }
    const faceQ = camera.quaternion.clone().multiply(tmpQ.setFromEuler(new THREE.Euler(0, 0, 0)));
    const q = scanQ.clone().slerp(faceQ, lift);
    q.multiply(tmpQ.setFromEuler(new THREE.Euler(lerp(-0.5, 0, enter) + away * 0.6, 0, away * -0.5)));
    phone.group.quaternion.copy(q);

    // Screen: camera view while scanning, then the menu
    const camOn = ease(p, 0.46, 0.49) * (1 - ease(p, 0.6, 0.63));
    const menuOn = ease(p, 0.6, 0.64);
    (phone.camLayer.material as THREE.MeshBasicMaterial).opacity = camOn;
    (phone.uiLayer.material as THREE.MeshBasicMaterial).opacity = camOn;
    (phone.menuLayer.material as THREE.MeshBasicMaterial).opacity = menuOn;
    if (camOn > 0.01 && phone.group.visible) {
      // Render the scene from the phone's back camera
      phoneCam.position.copy(pos);
      phoneCam.lookAt(CARD_IN_STAND);
      phoneCam.rotateZ(-0.1);
      phone.group.visible = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, phoneCam);
      renderer.setRenderTarget(null);
      phone.group.visible = true;
      drawScanner(ease(p, 0.49, 0.565), p > 0.565);
      uiTex.needsUpdate = true;
    }

    // ── Dish: lowered onto the table, then steam ──
    const serve = ease(p, 0.83, 0.93);
    dish.position.set(DISH_AT.x, lerp(0.5, 0, serve), DISH_AT.z);
    dish.visible = serve > 0.001;
    dish.rotation.y = 0.6 + (1 - serve) * 0.8;
    wine.visible = serve > 0.001;
    wine.position.y = lerp(0.5, 0, ease(p, 0.86, 0.96));
    const steamOn = ease(p, 0.93, 0.98);
    steam.forEach((s, j) => {
      const life = ((t * 0.35 + j / steam.length) % 1);
      s.position.set(DISH_AT.x + Math.sin(t * 0.9 + j * 2) * 0.02 + (j % 3 - 1) * 0.02, 0.07 + life * 0.22, DISH_AT.z + (j % 2 ? 0.01 : -0.01));
      s.material.opacity = steamOn * Math.sin(life * Math.PI) * 0.5;
      s.scale.set(0.07 + life * 0.08, 0.14 + life * 0.12, 1);
    });

    renderer.render(scene, camera);
  }

  function drawScanner(scan: number, found: boolean) {
    const g = ui.g, W = 256, H = 552;
    g.clearRect(0, 0, W, H);
    // Darken the edges like a camera viewfinder
    const v = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 300);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // Corner brackets around the code
    const bx = 38, by = 160, bw = W - 76, bh = 230, L = 34;
    g.strokeStyle = found ? "#8EF0B4" : "#fff";
    g.lineWidth = 5; g.lineCap = "round";
    for (const [x, y, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      g.beginPath(); g.moveTo(x, y + L * sy); g.lineTo(x, y); g.lineTo(x + L * sx, y); g.stroke();
    }
    if (!found) {
      const y = by + 10 + scan * (bh - 20);
      const grd = g.createLinearGradient(0, y - 30, 0, y);
      grd.addColorStop(0, "rgba(142,240,180,0)"); grd.addColorStop(1, "rgba(142,240,180,0.45)");
      g.fillStyle = grd; g.fillRect(bx + 8, y - 30, bw - 16, 30);
      g.fillStyle = "#8EF0B4"; g.fillRect(bx + 8, y - 1.5, bw - 16, 3);
    }
    // Pill at the bottom
    g.fillStyle = found ? "#8EF0B4" : "rgba(255,255,255,0.18)";
    roundRect(g, W / 2 - 78, H - 92, 156, 40, 20); g.fill();
    g.fillStyle = found ? "#0E2A19" : "#fff";
    g.font = "600 17px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(found ? "✓  Bella Vista menu" : "Scanning…", W / 2, H - 66);
    // Top: camera mode labels
    g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "600 13px system-ui, sans-serif";
    g.fillText("PHOTO      VIDEO      QR", W / 2, 46);
  }

  frame();

  return {
    update(p) { progress = p; },
    resize(w, h) {
      sized = w > 0 && h > 0;
      if (!sized) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      // Keep the scene framed on tall phones
      camera.fov = w / h < 0.8 ? 44 : 32;
      camera.updateProjectionMatrix();
    },
    setRunning(on) { running = on; if (on) clock.getDelta(); },
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          Object.values(mat).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); });
          mat.dispose();
        });
      });
      rt.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}
