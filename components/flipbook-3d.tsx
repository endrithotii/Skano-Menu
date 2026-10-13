"use client";

/*
 * 3D page-turn book for menu pages (images).
 *
 * React port of flipbook-vue v1.0.0-beta.4 by Takeshi Sone (https://github.com/ts1/flipbook-vue),
 * the same effect skano.menu uses. Original code: Copyright (c) 2023 Takeshi Sone, MIT License.
 *
 * How it works: a turning page is cut into `nPolygons` vertical strips. Each strip is positioned in
 * 3D along a curve (CSS matrix3d), so the page bends while it turns, and shading / gloss gradients
 * are drawn on every strip. Tap a page to zoom, drag or tap the margins to turn.
 *
 * Written as a class component on purpose: the original is a mutable, frame-by-frame state machine,
 * and instance fields + forceUpdate map onto it 1:1.
 */

import React from "react";
import {
  identity, multiply, perspective as perspectiveM, rotateY as rotateYM,
  toString as matrixToString, translate as translateM, translate3d as translate3dM,
} from "rematrix";

type M = ReturnType<typeof identity>;

class Matrix {
  m: M;
  constructor(arg?: Matrix) {
    this.m = arg ? ([...arg.m] as M) : identity();
  }
  clone() { return new Matrix(this); }
  multiply(m: M) { this.m = multiply(this.m, m); }
  perspective(d: number) { this.multiply(perspectiveM(d)); }
  transformX(x: number) { return (x * this.m[0] + this.m[12]) / (x * this.m[3] + this.m[15]); }
  translate(x: number, y = 0) { this.multiply(translateM(x, y)); }
  translate3d(x: number, y: number, z: number) { this.multiply(translate3dM(x, y, z)); }
  rotateY(deg: number) { this.multiply(rotateYM(deg)); }
  toString() { return matrixToString(this.m); }
}

const easeIn = (x: number) => x ** 2;
const easeOut = (x: number) => 1 - easeIn(1 - x);
const easeInOut = (x: number) => (x < 0.5 ? easeIn(x * 2) / 2 : 0.5 + easeOut((x - 0.5) * 2) / 2);

type Direction = "left" | "right";

export interface FlipbookState {
  /** 1-based page numbers currently visible (one or two) */
  visiblePages: number[];
  numPages: number;
  canFlipLeft: boolean;
  canFlipRight: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomed: boolean;
  /** Where the open pages sit inside the component (px, unzoomed, once settled), or null before layout */
  bounds: { left: number; right: number; top: number; height: number; width: number } | null;
}

export interface Flipbook3DProps {
  /** Page image urls. Put `null` first to show the cover alone on the right in two-page view. */
  pages: (string | null)[];
  flipDuration?: number;
  zoomDuration?: number;
  zooms?: number[];
  perspective?: number;
  nPolygons?: number;
  ambient?: number;
  gloss?: number;
  swipeMin?: number;
  singlePage?: boolean;
  clickToZoom?: boolean;
  dragToFlip?: boolean;
  /** Color of the back of a page that has no image */
  blankColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onStateChange?: (state: FlipbookState) => void;
}

interface FlipState {
  progress: number;
  direction: Direction | null;
  frontImage: string | null;
  backImage: string | null;
  auto: boolean;
  opacity: number;
}

type Polygon = [key: string, image: string | null, lighting: string, bgPos: string, transform: string, z: number];

export class Flipbook3D extends React.Component<Flipbook3DProps> {
  static defaultProps = {
    flipDuration: 1000,
    zoomDuration: 500,
    zooms: [1, 2, 4],
    perspective: 2400,
    nPolygons: 10,
    ambient: 0.4,
    gloss: 0.6,
    swipeMin: 3,
    singlePage: false,
    clickToZoom: true,
    dragToFlip: true,
    blankColor: "#ddd",
  };

  // ── state (mutated in place, then forceUpdate) ──
  viewWidth = 0;
  viewHeight = 0;
  imageWidth: number | null = null;
  imageHeight: number | null = null;
  displayedPages = 1;
  currentPage = 0;
  firstPage = 0;
  secondPage = 1;
  zoomIndex = 0;
  zoom = 1;
  zooming = false;
  touchStartX: number | null = null;
  touchStartY: number | null = null;
  maxMove = 0;
  activeCursor: string | null = null;
  hasTouchEvents = false;
  hasPointerEvents = false;
  minX = Infinity;
  maxX = -Infinity;
  flip: FlipState = { progress: 0, direction: null, frontImage: null, backImage: null, auto: false, opacity: 1 };
  currentCenterOffset: number | null = null;
  animatingCenter = false;
  startScrollLeft = 0;
  startScrollTop = 0;
  scrollLeft = 0;
  scrollTop = 0;
  imageLoadCallback: (() => void) | null = null;
  imageLoadFallback: ReturnType<typeof setTimeout> | null = null;
  unmounted = false;
  lastReported = "";

  viewportRef = React.createRef<HTMLDivElement>();
  resizeObserver: ResizeObserver | null = null;

  private get p() {
    return this.props as Required<Flipbook3DProps>;
  }

  // ── derived values ──
  get pages() { return this.p.pages; }
  get zooms() { return this.p.zooms?.length ? this.p.zooms : [1]; }
  get numPages() { return this.pages[0] === null ? this.pages.length - 1 : this.pages.length; }
  get canGoForward() { return !this.flip.direction && this.currentPage < this.pages.length - this.displayedPages; }
  get canGoBack() {
    return !this.flip.direction && this.currentPage >= this.displayedPages &&
      !(this.displayedPages === 1 && !this.pageUrl(this.firstPage - 1));
  }
  get canFlipLeft() { return this.canGoBack; }
  get canFlipRight() { return this.canGoForward; }
  get canZoomIn() { return !this.zooming && this.zoomIndex < this.zooms.length - 1; }
  get canZoomOut() { return !this.zooming && this.zoomIndex > 0; }
  get leftPage() { return this.firstPage; }
  get rightPage() { return this.secondPage; }
  get showLeftPage() { return !!this.pageUrl(this.leftPage); }
  get showRightPage() { return !!this.pageUrl(this.rightPage) && this.displayedPages === 2; }
  get pageScale() {
    if (!this.imageWidth || !this.imageHeight) return 1;
    const xScale = this.viewWidth / this.displayedPages / this.imageWidth;
    const yScale = this.viewHeight / this.imageHeight;
    const scale = Math.min(xScale, yScale);
    return scale < 1 ? scale : 1;
  }
  get pageWidth() { return Math.round((this.imageWidth ?? 0) * this.pageScale); }
  get pageHeight() { return Math.round((this.imageHeight ?? 0) * this.pageScale); }
  get xMargin() { return (this.viewWidth - this.pageWidth * this.displayedPages) / 2; }
  get yMargin() { return (this.viewHeight - this.pageHeight) / 2; }
  get polygonWidth() { return Math.ceil(this.pageWidth / this.p.nPolygons + 1 / this.zoom) + "px"; }
  get boundingLeft() {
    if (this.displayedPages === 1) return this.xMargin;
    const x = this.pageUrl(this.leftPage) ? this.xMargin : this.viewWidth / 2;
    return x < this.minX ? x : this.minX;
  }
  get boundingRight() {
    if (this.displayedPages === 1) return this.viewWidth - this.xMargin;
    const x = this.pageUrl(this.rightPage) ? this.viewWidth - this.xMargin : this.viewWidth / 2;
    return x > this.maxX ? x : this.maxX;
  }
  get centerOffset() { return Math.round(this.viewWidth / 2 - (this.boundingLeft + this.boundingRight) / 2); }
  get centerOffsetSmoothed() { return Math.round(this.currentCenterOffset ?? 0); }
  get dragToScroll() { return !this.hasTouchEvents; }
  get cursor() {
    if (this.activeCursor) return this.activeCursor;
    if (this.p.clickToZoom && this.canZoomIn) return "zoom-in";
    if (this.p.clickToZoom && this.canZoomOut) return "zoom-out";
    if (this.p.dragToFlip) return "grab";
    return "auto";
  }
  get scrollLeftMin() {
    const w = (this.boundingRight - this.boundingLeft) * this.zoom;
    const base = (this.boundingLeft + this.centerOffsetSmoothed) * this.zoom;
    return w < this.viewWidth ? base - (this.viewWidth - w) / 2 : base;
  }
  get scrollLeftMax() {
    const w = (this.boundingRight - this.boundingLeft) * this.zoom;
    if (w < this.viewWidth) return (this.boundingLeft + this.centerOffsetSmoothed) * this.zoom - (this.viewWidth - w) / 2;
    return (this.boundingRight + this.centerOffsetSmoothed) * this.zoom - this.viewWidth;
  }
  get scrollTopMin() {
    const h = this.pageHeight * this.zoom;
    return h < this.viewHeight ? this.yMargin * this.zoom - (this.viewHeight - h) / 2 : this.yMargin * this.zoom;
  }
  get scrollTopMax() {
    const h = this.pageHeight * this.zoom;
    if (h < this.viewHeight) return this.yMargin * this.zoom - (this.viewHeight - h) / 2;
    return (this.yMargin + this.pageHeight) * this.zoom - this.viewHeight;
  }
  get scrollLeftLimited() { return Math.min(this.scrollLeftMax, Math.max(this.scrollLeftMin, this.scrollLeft)); }
  get scrollTopLimited() { return Math.min(this.scrollTopMax, Math.max(this.scrollTopMin, this.scrollTop)); }

  pageUrl(page: number) { return this.pages[page] || null; }

  // ── lifecycle ──
  componentDidMount() {
    // React (dev / Strict Mode) may unmount and mount the same instance again
    this.unmounted = false;
    this.viewWidth = 0;
    this.viewHeight = 0;
    const vp = this.viewportRef.current;
    if (vp) {
      // Non-passive so a horizontal swipe doesn't also scroll the page
      vp.addEventListener("touchmove", this.onTouchMove, { passive: false });
      vp.addEventListener("wheel", this.onWheel, { passive: false });
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(vp);
    }
    window.addEventListener("resize", this.onResize, { passive: true });
    this.zoom = this.zooms[0];
    this.onResize();
    this.measureFirstImage();
  }

  componentDidUpdate(prev: Flipbook3DProps) {
    if (prev.pages !== this.props.pages) {
      this.fixFirstPage();
      if (!this.imageWidth) this.measureFirstImage();
      this.preloadImages();
    }
    this.afterRender();
  }

  componentWillUnmount() {
    this.unmounted = true;
    const vp = this.viewportRef.current;
    vp?.removeEventListener("touchmove", this.onTouchMove);
    vp?.removeEventListener("wheel", this.onWheel);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    if (this.imageLoadFallback) clearTimeout(this.imageLoadFallback);
  }

  update = () => { if (!this.unmounted) this.forceUpdate(); };

  /** Things the Vue version did in watchers: smooth centering, scroll sync, reporting state */
  afterRender() {
    if (this.imageWidth !== null && this.viewWidth > 0 && this.currentCenterOffset === null) {
      // First layout: jump straight to the centered position (no animation)
      this.currentCenterOffset = this.centerOffset;
      this.update();
      return;
    }
    if (this.currentCenterOffset !== null && !this.animatingCenter && Math.abs(this.centerOffset - this.currentCenterOffset) >= 0.5) {
      this.animatingCenter = true;
      const animate = () => requestAnimationFrame(() => {
        if (this.unmounted || this.currentCenterOffset === null) return;
        const diff = this.centerOffset - this.currentCenterOffset;
        if (Math.abs(diff) < 0.5) {
          this.currentCenterOffset = this.centerOffset;
          this.animatingCenter = false;
        } else {
          this.currentCenterOffset += diff * 0.1;
          animate();
        }
        this.update();
      });
      animate();
    }
    const vp = this.viewportRef.current;
    if (vp && (this.zoom > 1 || this.zooming)) {
      vp.scrollLeft = this.scrollLeftLimited;
      vp.scrollTop = this.scrollTopLimited;
    }
    this.report();
  }

  report() {
    if (!this.props.onStateChange) return;
    const visible: number[] = [];
    const toNumber = (i: number) => (this.pages[0] === null ? i : i + 1);
    // Based on the settled page, so the counter doesn't jump while a page is turning
    const cur = this.currentPage;
    const candidates = this.displayedPages === 2 ? [cur, cur + 1] : [cur];
    for (const i of candidates) if (this.pageUrl(i)) visible.push(toNumber(i));
    const state: FlipbookState = {
      visiblePages: visible,
      numPages: this.numPages,
      canFlipLeft: this.canFlipLeft,
      canFlipRight: this.canFlipRight,
      canZoomIn: this.canZoomIn,
      canZoomOut: this.canZoomOut,
      zoomed: this.zoom > 1,
      bounds: this.settledBounds(),
    };
    const key = JSON.stringify(state);
    if (key !== this.lastReported) {
      this.lastReported = key;
      this.props.onStateChange(state);
    }
  }

  /** Bounds of the visible pages when no page is turning (so buttons beside the book don't jump) */
  settledBounds() {
    if (this.imageWidth === null || !this.viewWidth || !this.pageWidth) return null;
    const cur = this.currentPage;
    let left: number;
    let right: number;
    if (this.displayedPages === 1) {
      left = this.xMargin;
      right = this.xMargin + this.pageWidth;
    } else {
      left = this.pageUrl(cur) ? this.xMargin : this.viewWidth / 2;
      right = this.pageUrl(cur + 1) ? this.viewWidth - this.xMargin : this.viewWidth / 2;
    }
    const offset = Math.round(this.viewWidth / 2 - (left + right) / 2); // the book is centered
    return {
      left: Math.round(left + offset),
      right: Math.round(right + offset),
      top: Math.round(this.yMargin),
      height: this.pageHeight,
      width: this.viewWidth,
    };
  }

  measureFirstImage() {
    const first = this.pages.find((u): u is string => !!u);
    if (!first) return;
    const img = new Image();
    img.onload = () => {
      if (this.unmounted || this.imageWidth !== null) return;
      this.imageWidth = img.naturalWidth;
      this.imageHeight = img.naturalHeight;
      this.preloadImages();
      this.update();
    };
    img.src = first;
  }

  onResize = () => {
    const vp = this.viewportRef.current;
    if (!vp) return;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    if (w === this.viewWidth && h === this.viewHeight) return;
    this.viewWidth = w;
    this.viewHeight = h;
    this.displayedPages = w > h && !this.p.singlePage ? 2 : 1;
    if (this.displayedPages === 2) this.setCurrentPage(this.currentPage & ~1);
    this.fixFirstPage();
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.update();
  };

  setCurrentPage(p: number) {
    this.currentPage = p;
    this.firstPage = p;
    this.secondPage = p + 1;
    this.preloadImages();
  }

  fixFirstPage() {
    if (this.displayedPages === 1 && this.currentPage === 0 && this.pages.length && !this.pageUrl(0)) {
      this.setCurrentPage(this.currentPage + 1);
    }
  }

  preloadImages() {
    for (let i = this.currentPage - 3; i <= this.currentPage + 3; i++) {
      const url = this.pageUrl(i);
      if (url) new Image().src = url;
    }
  }

  // ── public API ──
  flipLeft = () => { if (this.canFlipLeft) this.flipStart("left", true); };
  flipRight = () => { if (this.canFlipRight) this.flipStart("right", true); };
  zoomIn = () => {
    if (!this.canZoomIn) return;
    this.zoomIndex += 1;
    this.zoomTo(this.zooms[this.zoomIndex]);
  };
  zoomOut = () => {
    if (!this.canZoomOut) return;
    this.zoomIndex -= 1;
    this.zoomTo(this.zooms[this.zoomIndex]);
  };

  // ── page turn geometry ──
  makePolygonArray(face: "front" | "back"): Polygon[] {
    if (!this.flip.direction) return [];
    let progress = this.flip.progress;
    let direction: Direction = this.flip.direction;
    if (this.displayedPages === 1 && direction !== "right") {
      progress = 1 - progress;
      direction = "right";
    }
    this.flip.opacity = this.displayedPages === 1 && progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    const image = face === "front" ? this.flip.frontImage : this.flip.backImage;
    const nPolygons = this.p.nPolygons;
    const polygonWidth = this.pageWidth / nPolygons;
    let pageX = this.xMargin;
    let originRight = false;

    if (this.displayedPages === 1) {
      if (face === "back") {
        originRight = true;
        pageX = this.xMargin - this.pageWidth;
      }
    } else if (direction === "left") {
      if (face === "back") pageX = this.viewWidth / 2;
      else originRight = true;
    } else {
      if (face === "front") pageX = this.viewWidth / 2;
      else originRight = true;
    }

    const pageMatrix = new Matrix();
    pageMatrix.translate(this.viewWidth / 2);
    pageMatrix.perspective(this.p.perspective);
    pageMatrix.translate(-this.viewWidth / 2);
    pageMatrix.translate(pageX, this.yMargin);

    let pageRotation = 0;
    if (progress > 0.5) pageRotation = -(progress - 0.5) * 2 * 180;
    if (direction === "left") pageRotation = -pageRotation;
    if (face === "back") pageRotation += 180;
    if (pageRotation) {
      if (originRight) pageMatrix.translate(this.pageWidth);
      pageMatrix.rotateY(pageRotation);
      if (originRight) pageMatrix.translate(-this.pageWidth);
    }

    let theta = progress < 0.5 ? progress * 2 * Math.PI : (1 - (progress - 0.5) * 2) * Math.PI;
    if (theta === 0) theta = 1e-9;
    const radius = this.pageWidth / theta;
    let radian = 0;
    const dRadian = theta / nPolygons;
    let rotate = (dRadian / 2 / Math.PI) * 180;
    let dRotate = (dRadian / Math.PI) * 180;
    if (originRight) rotate = (-theta / Math.PI) * 180 + dRotate / 2;
    if (face === "back") {
      rotate = -rotate;
      dRotate = -dRotate;
    }

    this.minX = Infinity;
    this.maxX = -Infinity;
    const results: Polygon[] = [];
    for (let i = 0; i < nPolygons; i++) {
      const bgPos = `${(i / (nPolygons - 1)) * 100}% 0px`;
      const m = pageMatrix.clone();
      const rad = originRight ? theta - radian : radian;
      let x = Math.sin(rad) * radius;
      if (originRight) x = this.pageWidth - x;
      let z = (1 - Math.cos(rad)) * radius;
      if (face === "back") z = -z;
      m.translate3d(x, 0, z);
      m.rotateY(-rotate);
      const x0 = m.transformX(0);
      const x1 = m.transformX(polygonWidth);
      this.maxX = Math.max(x0, x1, this.maxX);
      this.minX = Math.min(x0, x1, this.minX);
      const lighting = this.computeLighting(pageRotation - rotate, dRotate);
      radian += dRadian;
      rotate += dRotate;
      results.push([face + i, image, lighting, bgPos, m.toString(), Math.abs(Math.round(z))]);
    }
    return results;
  }

  computeLighting(rot: number, dRotate: number) {
    const gradients: string[] = [];
    const points = [-0.5, -0.25, 0, 0.25, 0.5];
    const { ambient, gloss } = this.p;
    if (ambient < 1) {
      const blackness = 1 - ambient;
      const d = points.map((p) => (1 - Math.cos(((rot - dRotate * p) / 180) * Math.PI)) * blackness);
      gradients.push(`linear-gradient(to right, rgba(0,0,0,${d[0]}), rgba(0,0,0,${d[1]}) 25%, rgba(0,0,0,${d[2]}) 50%, rgba(0,0,0,${d[3]}) 75%, rgba(0,0,0,${d[4]}))`);
    }
    if (gloss > 0) {
      const DEG = 30;
      const POW = 200;
      const s = points.map((p) => Math.max(
        Math.cos(((rot + DEG - dRotate * p) / 180) * Math.PI) ** POW,
        Math.cos(((rot - DEG - dRotate * p) / 180) * Math.PI) ** POW,
      ));
      gradients.push(`linear-gradient(to right, rgba(255,255,255,${s[0] * gloss}), rgba(255,255,255,${s[1] * gloss}) 25%, rgba(255,255,255,${s[2] * gloss}) 50%, rgba(255,255,255,${s[3] * gloss}) 75%, rgba(255,255,255,${s[4] * gloss}))`);
    }
    return gradients.join(",");
  }

  // ── animation ──
  flipStart(direction: Direction, auto: boolean) {
    if (direction !== "right") {
      if (this.displayedPages === 1) {
        this.flip.frontImage = this.pageUrl(this.currentPage - 1);
        this.flip.backImage = null;
      } else {
        this.flip.frontImage = this.pageUrl(this.firstPage);
        this.flip.backImage = this.pageUrl(this.currentPage - this.displayedPages + 1);
      }
    } else if (this.displayedPages === 1) {
      this.flip.frontImage = this.pageUrl(this.currentPage);
      this.flip.backImage = null;
    } else {
      this.flip.frontImage = this.pageUrl(this.secondPage);
      this.flip.backImage = this.pageUrl(this.currentPage + this.displayedPages);
    }
    this.flip.direction = direction;
    this.flip.progress = 0;
    this.update();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.flip.direction !== "right") {
        if (this.displayedPages === 2) this.firstPage = this.currentPage - this.displayedPages;
      } else if (this.displayedPages === 1) {
        this.firstPage = this.currentPage + this.displayedPages;
      } else {
        this.secondPage = this.currentPage + 1 + this.displayedPages;
      }
      this.update();
      if (auto) this.flipAuto(true);
    }));
  }

  flipAuto(ease: boolean) {
    const t0 = Date.now();
    const duration = this.p.flipDuration * (1 - this.flip.progress);
    const startRatio = this.flip.progress;
    this.flip.auto = true;
    const animate = () => requestAnimationFrame(() => {
      if (this.unmounted) return;
      let ratio = startRatio + (Date.now() - t0) / duration;
      if (ratio > 1) ratio = 1;
      this.flip.progress = ease ? easeInOut(ratio) : ratio;
      if (ratio < 1) {
        this.update();
        animate();
        return;
      }
      const forward = this.flip.direction === "right";
      this.setCurrentPage(this.currentPage + (forward ? this.displayedPages : -this.displayedPages));
      if (this.displayedPages === 1 && forward) this.flip.direction = null;
      else this.waitForPageImages(() => { this.flip.direction = null; });
      this.flip.auto = false;
      this.update();
    });
    animate();
  }

  flipRevert() {
    const t0 = Date.now();
    const duration = this.p.flipDuration * this.flip.progress;
    const startRatio = this.flip.progress;
    this.flip.auto = true;
    const animate = () => requestAnimationFrame(() => {
      if (this.unmounted) return;
      let ratio = startRatio - (startRatio * (Date.now() - t0)) / duration;
      if (ratio < 0) ratio = 0;
      this.flip.progress = ratio;
      if (ratio > 0) {
        this.update();
        animate();
        return;
      }
      this.firstPage = this.currentPage;
      this.secondPage = this.currentPage + 1;
      if (this.displayedPages === 1 && this.flip.direction !== "right") this.flip.direction = null;
      else this.waitForPageImages(() => { this.flip.direction = null; });
      this.flip.auto = false;
      this.update();
    });
    animate();
  }

  /** Keep the turning page on screen until the newly revealed page image has painted (avoids a flash) */
  waitForPageImages(cb: () => void) {
    this.imageLoadCallback = cb;
    if (this.imageLoadFallback) clearTimeout(this.imageLoadFallback);
    this.imageLoadFallback = setTimeout(() => this.didLoadImage(), 250);
  }

  didLoadImage = () => {
    if (this.imageLoadFallback) {
      clearTimeout(this.imageLoadFallback);
      this.imageLoadFallback = null;
    }
    const cb = this.imageLoadCallback;
    if (!cb) return;
    this.imageLoadCallback = null;
    cb();
    this.update();
  };

  // ── zoom ──
  zoomTo(zoom: number, zoomAt?: { pageX: number; pageY: number }) {
    const vp = this.viewportRef.current;
    if (!vp) return;
    let fixedX: number;
    let fixedY: number;
    if (zoomAt) {
      const rect = vp.getBoundingClientRect();
      fixedX = zoomAt.pageX - window.scrollX - rect.left;
      fixedY = zoomAt.pageY - window.scrollY - rect.top;
    } else {
      fixedX = vp.clientWidth / 2;
      fixedY = vp.clientHeight / 2;
    }
    const start = this.zoom;
    const end = zoom;
    const startX = vp.scrollLeft;
    const startY = vp.scrollTop;
    const endX = ((fixedX + startX) / start) * end - fixedX;
    const endY = ((fixedY + startY) / start) * end - fixedY;
    const t0 = Date.now();
    this.zooming = true;
    const animate = () => requestAnimationFrame(() => {
      if (this.unmounted) return;
      const t = Date.now() - t0;
      const ratio = easeInOut(Math.min(1, t / this.p.zoomDuration));
      this.zoom = start + (end - start) * ratio;
      this.scrollLeft = startX + (endX - startX) * ratio;
      this.scrollTop = startY + (endY - startY) * ratio;
      if (t < this.p.zoomDuration) {
        this.update();
        animate();
      } else {
        this.zooming = false;
        this.zoom = zoom;
        this.scrollLeft = endX;
        this.scrollTop = endY;
        this.update();
      }
    });
    animate();
  }

  zoomAt(at: { pageX: number; pageY: number }) {
    this.zoomIndex = (this.zoomIndex + 1) % this.zooms.length;
    this.zoomTo(this.zooms[this.zoomIndex], at);
  }

  // ── input ──
  swipeStart(t: { pageX: number; pageY: number }) {
    this.touchStartX = t.pageX;
    this.touchStartY = t.pageY;
    this.maxMove = 0;
    const vp = this.viewportRef.current;
    if (this.zoom <= 1) {
      if (this.p.dragToFlip) this.activeCursor = "grab";
    } else if (vp) {
      this.startScrollLeft = vp.scrollLeft;
      this.startScrollTop = vp.scrollTop;
      this.activeCursor = "all-scroll";
    }
    this.update();
  }

  swipeMove(t: { pageX: number; pageY: number }) {
    if (this.touchStartX == null || this.touchStartY == null) return false;
    const x = t.pageX - this.touchStartX;
    const y = t.pageY - this.touchStartY;
    this.maxMove = Math.max(this.maxMove, Math.abs(x), Math.abs(y));
    if (this.zoom > 1) {
      if (this.dragToScroll) {
        this.scrollLeft = this.startScrollLeft - x;
        this.scrollTop = this.startScrollTop - y;
        this.update();
      }
      return false;
    }
    if (!this.p.dragToFlip || Math.abs(y) > Math.abs(x)) return false;
    this.activeCursor = "grabbing";
    if (x > 0) {
      if (this.flip.direction === null && this.canFlipLeft && x >= this.p.swipeMin) this.flipStart("left", false);
      if (this.flip.direction === "left") this.flip.progress = Math.min(1, x / this.pageWidth);
    } else {
      if (this.flip.direction === null && this.canFlipRight && x <= -this.p.swipeMin) this.flipStart("right", false);
      if (this.flip.direction === "right") this.flip.progress = Math.min(1, -x / this.pageWidth);
    }
    this.update();
    return true;
  }

  swipeEnd(t: { pageX: number; pageY: number }) {
    if (this.touchStartX == null) return;
    if (this.p.clickToZoom && this.maxMove < this.p.swipeMin) this.zoomAt(t);
    if (this.flip.direction !== null && !this.flip.auto) {
      if (this.flip.progress > 1 / 4) this.flipAuto(false);
      else this.flipRevert();
    }
    this.touchStartX = null;
    this.activeCursor = null;
    this.update();
  }

  onTouchStart = (e: React.TouchEvent) => {
    this.hasTouchEvents = true;
    this.swipeStart(e.changedTouches[0]);
  };
  onTouchMove = (e: TouchEvent) => {
    if (this.swipeMove(e.changedTouches[0]) && e.cancelable) e.preventDefault();
  };
  onTouchEnd = (e: React.TouchEvent) => this.swipeEnd(e.changedTouches[0]);
  onPointerDown = (e: React.PointerEvent) => {
    this.hasPointerEvents = true;
    if (this.hasTouchEvents || e.button !== 0) return;
    this.swipeStart(e);
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  onPointerMove = (e: React.PointerEvent) => { if (!this.hasTouchEvents) this.swipeMove(e); };
  onPointerUp = (e: React.PointerEvent) => {
    if (this.hasTouchEvents) return;
    this.swipeEnd(e);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  onWheel = (e: WheelEvent) => {
    const vp = this.viewportRef.current;
    if (vp && this.zoom > 1 && this.dragToScroll) {
      this.scrollLeft = vp.scrollLeft + e.deltaX;
      this.scrollTop = vp.scrollTop + e.deltaY;
      if (e.cancelable) e.preventDefault();
      this.update();
    }
  };

  // ── render ──
  render() {
    const { className, style, blankColor } = this.props;
    const ready = this.imageWidth !== null && this.viewWidth > 0;
    const polygons = ready ? [...this.makePolygonArray("front"), ...this.makePolygonArray("back")] : [];
    const zoomed = this.zooming || this.zoom > 1;
    const pageStyle: React.CSSProperties = {
      position: "absolute",
      width: this.pageWidth,
      height: this.pageHeight,
      top: this.yMargin,
      backfaceVisibility: "hidden",
      userSelect: "none",
      pointerEvents: "none",
    };
    const leftUrl = this.pageUrl(this.leftPage);
    const rightUrl = this.pageUrl(this.rightPage);

    return (
      <div
        ref={this.viewportRef}
        className={className}
        style={{
          ...style,
          position: "relative",
          overflow: !zoomed ? "visible" : this.dragToScroll ? "hidden" : "scroll",
          WebkitOverflowScrolling: "touch",
          cursor: this.cursor === "grabbing" ? "grabbing" : "auto",
          touchAction: zoomed ? "auto" : "pan-y",
        } as React.CSSProperties}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        onPointerCancel={this.onPointerUp}
        onTouchEnd={this.onTouchEnd}
        onTouchCancel={this.onTouchEnd}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", transformOrigin: "top left", transform: `scale(${this.zoom})`, userSelect: "none" }}>
          {/* Clicking the empty area beside the book turns the page */}
          <div onClick={this.flipLeft} style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", cursor: this.canFlipLeft ? "pointer" : "auto" }} />
          <div onClick={this.flipRight} style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", cursor: this.canFlipRight ? "pointer" : "auto" }} />

          {ready && (
            <div style={{ transform: `translateX(${this.centerOffsetSmoothed}px)` }}>
              {this.showLeftPage && leftUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key="left" src={leftUrl} alt="" draggable={false} onLoad={this.didLoadImage}
                  style={{ ...pageStyle, left: this.xMargin }} />
              )}
              {this.showRightPage && rightUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key="right" src={rightUrl} alt="" draggable={false} onLoad={this.didLoadImage}
                  style={{ ...pageStyle, left: this.viewWidth / 2 }} />
              )}

              <div style={{ opacity: this.flip.opacity }}>
                {polygons.map(([key, image, lighting, bgPos, transform, z]) => (
                  <div
                    key={key}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      backfaceVisibility: "hidden",
                      backgroundRepeat: "no-repeat",
                      transformOrigin: "center left",
                      backgroundColor: image ? undefined : blankColor,
                      backgroundImage: image ? `url("${image}")` : undefined,
                      backgroundSize: `${this.pageWidth}px ${this.pageHeight}px`,
                      backgroundPosition: bgPos,
                      width: this.polygonWidth,
                      height: this.pageHeight,
                      transform,
                      zIndex: z,
                    }}
                  >
                    {lighting && <div style={{ width: "100%", height: "100%", backgroundImage: lighting }} />}
                  </div>
                ))}
              </div>

              {/* Grab area over the visible pages: drag to turn, tap to zoom */}
              <div
                onTouchStart={this.onTouchStart}
                onPointerDown={this.onPointerDown}
                style={{
                  position: "absolute",
                  userSelect: "none",
                  left: this.boundingLeft,
                  top: this.yMargin,
                  width: this.boundingRight - this.boundingLeft,
                  height: this.pageHeight,
                  cursor: this.cursor,
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}
