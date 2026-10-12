// Minimal typings for the "page-flip" (StPageFlip) package, which ships without .d.ts files.
declare module "page-flip" {
  export interface FlipSetting {
    startPage: number;
    size: "fixed" | "stretch";
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    startZIndex: number;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    swipeDistance: number;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
  }

  export interface WidgetEvent {
    data: number | string | boolean | object;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(inBlock: HTMLElement, setting: Partial<FlipSetting>);
    on(eventName: "init" | "update" | "flip" | "changeOrientation" | "changeState", callback: (e: WidgetEvent) => void): PageFlip;
    off(eventName: string): void;
    destroy(): void;
    update(): void;
    loadFromImages(imagesHref: string[]): void;
    updateFromImages(imagesHref: string[]): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): "portrait" | "landscape";
    getRender(): object;
  }
}
