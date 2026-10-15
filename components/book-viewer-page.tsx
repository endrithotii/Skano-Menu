"use client";

// Full-screen public viewer for a PDF / photo menu: social links on top, the book in the middle,
// page-turn tabs on the screen edges, "Powered by Skano.Menu" below.
// Used for the single book menu and for the menus opened from a menu tree.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { MenuBook, renderPdfToImages } from "@/components/menu-book";
import { MoreButton } from "@/components/more-button";
import { AnnouncementNotice } from "@/components/announcement-notice";
import { parseMenuPages, type MenuPages } from "@/lib/menu-pages";

/** A PDF or photos shown one under the other (the scrolling view) */
export function ScrollMenu({ pages, className = "", dark = true }: { pages: MenuPages; className?: string; dark?: boolean }) {
  const pdfUrl = pages.kind === "pdf" ? pages.url : null;
  const [pdfImages, setPdfImages] = useState<{ url: string; images: string[] | null; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    let made: string[] = [];
    renderPdfToImages(pdfUrl, () => {}, () => cancelled)
      .then((images) => { made = images; if (!cancelled) setPdfImages({ url: pdfUrl, images }); })
      .catch(() => { if (!cancelled) setPdfImages({ url: pdfUrl, images: null, failed: true }); });
    return () => { cancelled = true; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [pdfUrl]);
  if (pages.kind === "images") return <ScrollPages urls={pages.urls} className={className} />;
  const ready = pdfImages?.url === pdfUrl ? pdfImages : null;
  if (ready?.images) return <ScrollPages urls={ready.images} className={className} />;
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-24 text-sm ${dark ? "text-white/70" : "text-gray-500"}`}>
      {ready?.failed ? "The menu could not be loaded." : (
        <>
          <span className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${dark ? "border-white/70" : "border-blue-500"}`} />
          Loading the menu…
        </>
      )}
    </div>
  );
}

/** Pages one under the other */
export function ScrollPages({ urls, className = "" }: { urls: string[]; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 sm:gap-5 px-0 sm:px-4 py-3 sm:py-5 ${className}`}>
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${i}-${url}`} src={url} alt={`Menu page ${i + 1}`} loading={i < 2 ? "eager" : "lazy"}
          className="block w-full max-w-[900px] h-auto shadow-2xl sm:rounded-sm bg-white" />
      ))}
    </div>
  );
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  tripadvisor?: string;
  tiktok?: string;
  x?: string;
  viber?: string;
  telegram?: string;
  /** Linked but not shown above the menu (set on the Social media page) */
  hidden?: string[];
}

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "x", "whatsapp", "viber", "telegram", "tripadvisor"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Only the links the restaurant wants to show (hidden ones removed) */
export function visibleSocialLinks(links: SocialLinks): SocialLinks {
  const hidden = Array.isArray(links.hidden) ? links.hidden : [];
  const out: SocialLinks = {};
  for (const k of SOCIAL_PLATFORMS) {
    const v = links[k];
    if (typeof v === "string" && v.trim() && !hidden.includes(k)) out[k] = v.trim();
  }
  return out;
}

export function parseSocialLinks(raw: string | null | undefined): SocialLinks {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Phone number as international digits: "+383 44 123 456" and "00383 44 123 456" both give "38344123456" */
export function phoneDigits(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.startsWith("00") ? d.slice(2) : d;
}
/** A phone number rather than a username */
const isPhone = (v: string) => /^\+?[\d\s()./-]{6,}$/.test(v.trim());
/** Phone number written without the country code (e.g. "044 123 456"): apps can't open those */
export function phoneMissingCountryCode(v: string): boolean {
  const t = v.trim();
  return isPhone(t) && !t.startsWith("+") && !t.replace(/[\s()./-]/g, "").startsWith("00");
}

// Domains of each platform. A link typed without https:// ("instagram.com/name") is still recognized.
const DOMAINS: Partial<Record<SocialPlatform, RegExp>> = {
  instagram: /^(?:www\.|m\.)?instagram\.com\//i,
  facebook: /^(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\//i,
  tiktok: /^(?:www\.|m\.|vm\.)?tiktok\.com\//i,
  x: /^(?:www\.|mobile\.)?(?:x|twitter)\.com\//i,
  telegram: /^(?:www\.)?(?:t\.me|telegram\.me)\//i,
};

/**
 * Link for what the restaurant typed.
 * - A full link is kept (https:// added when missing).
 * - A username becomes the profile link on the platform's main address (www.), which phones hand to the app.
 * - WhatsApp / Viber / Telegram numbers become chat links.
 */
export function makeSocialUrl(platform: SocialPlatform, raw: string): string {
  const value = raw.trim();
  if (!value) return "#";
  if (/^(https?:|viber:|tg:)/i.test(value)) return value;
  const bare = value.replace(/^\/+/, "");
  // A link without https://
  if (DOMAINS[platform]?.test(bare) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(bare)) {
    const path = DOMAINS[platform]?.test(bare) ? bare.replace(DOMAINS[platform]!, "") : null;
    if (path !== null) {
      // Rebuilt on the main address, the one phones hand over to the app
      if (platform === "instagram") return `https://www.instagram.com/${path}`;
      if (platform === "facebook") return `https://www.facebook.com/${path}`;
      if (platform === "tiktok") return `https://www.tiktok.com/${path}`;
      if (platform === "x") return `https://x.com/${path}`;
    }
    return `https://${bare}`;
  }
  const handle = value.replace(/^@/, "").replace(/\s+/g, "");
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${handle}/`;
    case "facebook": return `https://www.facebook.com/${handle}`;
    case "tiktok": return `https://www.tiktok.com/@${handle}`;
    case "x": return `https://x.com/${handle}`;
    case "whatsapp": return `https://wa.me/${phoneDigits(value)}`;
    case "viber": return `viber://chat?number=%2B${phoneDigits(value)}`;
    case "telegram": return isPhone(value) ? `https://t.me/+${phoneDigits(value)}` : `https://t.me/${handle}`;
    case "tripadvisor": return `https://www.tripadvisor.com/${handle}`;
  }
}

/** Links that open an app directly (not a web page): open them in the same tab, a new tab would stay empty */
export const opensApp = (href: string) => !/^https?:/i.test(href);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);
const TripAdvisorIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.587 5.587 0 0 0-.946 3.137 5.618 5.618 0 0 0 5.618 5.618 5.594 5.594 0 0 0 3.768-1.456l1.6 1.742 1.6-1.742a5.594 5.594 0 0 0 3.769 1.456 5.618 5.618 0 0 0 5.617-5.618 5.587 5.587 0 0 0-.946-3.137L24 6.648h-4.35a13.826 13.826 0 0 0-7.644-2.353zm0 1.723a12.068 12.068 0 0 1 5.736 1.44 5.616 5.616 0 0 0-5.736 5.462 5.616 5.616 0 0 0-5.735-5.461 12.068 12.068 0 0 1 5.735-1.441zm-5.371 3.51a3.895 3.895 0 1 1 0 7.789 3.895 3.895 0 0 1 0-7.79zm10.742 0a3.895 3.895 0 1 1 0 7.789 3.895 3.895 0 0 1 0-7.79zm-10.742 1.51a2.385 2.385 0 1 0 0 4.769 2.385 2.385 0 0 0 0-4.77zm10.742 0a2.385 2.385 0 1 0 0 4.769 2.385 2.385 0 0 0 0-4.77zm-10.742 1.078a1.307 1.307 0 1 1 0 2.614 1.307 1.307 0 0 1 0-2.614zm10.742 0a1.307 1.307 0 1 1 0 2.614 1.307 1.307 0 0 1 0-2.614z"/>
  </svg>
);

// TikTok, X, Viber and Telegram icons from Simple Icons (CC0)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
  </svg>
);
const ViberIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.696 6.7.633 9.817.57 12.933.488 18.776 6.12 20.36h.003l-.004 2.416s-.037.977.61 1.177c.777.242 1.234-.5 1.98-1.302.407-.44.972-1.084 1.397-1.58 3.85.326 6.812-.416 7.15-.525.776-.252 5.176-.816 5.892-6.657.74-6.02-.36-9.83-2.34-11.546-.596-.55-3.006-2.3-8.375-2.323 0 0-.395-.025-1.037-.017zm.058 1.693c.545-.004.88.017.88.017 4.542.02 6.717 1.388 7.222 1.846 1.675 1.435 2.53 4.868 1.906 9.897v.002c-.604 4.878-4.174 5.184-4.832 5.395-.28.09-2.882.737-6.153.524 0 0-2.436 2.94-3.197 3.704-.12.12-.26.167-.352.144-.13-.033-.166-.188-.165-.414l.02-4.018c-4.762-1.32-4.485-6.292-4.43-8.895.054-2.604.543-4.738 1.996-6.173 1.96-1.773 5.474-2.018 7.11-2.03zm.38 2.602c-.167 0-.303.135-.304.302 0 .167.133.303.3.305 1.624.01 2.946.537 4.028 1.592 1.073 1.046 1.62 2.468 1.633 4.334.002.167.14.3.307.3.166-.002.3-.138.3-.304-.014-1.984-.618-3.596-1.816-4.764-1.19-1.16-2.692-1.753-4.447-1.765zm-3.96.695c-.19-.032-.4.005-.616.117l-.01.002c-.43.247-.816.562-1.146.932-.002.004-.006.004-.008.008-.267.323-.42.638-.46.948-.008.046-.01.093-.007.14 0 .136.022.27.065.4l.013.01c.135.48.473 1.276 1.205 2.604.42.768.903 1.5 1.446 2.186.27.344.56.673.87.984l.132.132c.31.308.64.6.984.87.686.543 1.418 1.027 2.186 1.447 1.328.733 2.126 1.07 2.604 1.206l.01.014c.13.042.265.064.402.063.046.002.092 0 .138-.008.31-.036.627-.19.948-.46.004 0 .003-.002.008-.005.37-.33.683-.72.93-1.148l.003-.01c.225-.432.15-.842-.18-1.12-.004 0-.698-.58-1.037-.83-.36-.255-.73-.492-1.113-.71-.51-.285-1.032-.106-1.248.174l-.447.564c-.23.283-.657.246-.657.246-3.12-.796-3.955-3.955-3.955-3.955s-.037-.426.248-.656l.563-.448c.277-.215.456-.737.17-1.248-.217-.383-.454-.756-.71-1.115-.25-.34-.826-1.033-.83-1.035-.137-.165-.31-.265-.502-.297zm4.49.88c-.158.002-.29.124-.3.282-.01.167.115.312.282.324 1.16.085 2.017.466 2.645 1.15.63.688.93 1.524.906 2.57-.002.168.13.306.3.31.166.003.305-.13.31-.297.025-1.175-.334-2.193-1.067-2.994-.74-.81-1.777-1.253-3.05-1.346h-.024zm.463 1.63c-.16.002-.29.127-.3.287-.008.167.12.31.288.32.523.028.875.175 1.113.422.24.245.388.62.416 1.164.01.167.15.295.318.287.167-.008.295-.15.287-.317-.03-.644-.215-1.178-.58-1.557-.367-.378-.893-.574-1.52-.607h-.018z"/>
  </svg>
);
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

/** Name, icon and example of each platform (for the Social media page) */
export const SOCIAL_META: Record<SocialPlatform, { label: string; placeholder: string; hint: string; Icon: (p: { className?: string }) => React.ReactElement }> = {
  instagram: { label: "Instagram", placeholder: "yourrestaurant or https://instagram.com/yourrestaurant", hint: "Your username or the link to your profile", Icon: InstagramIcon },
  facebook: { label: "Facebook", placeholder: "yourrestaurant or https://facebook.com/yourrestaurant", hint: "Your page name or the link to your page", Icon: FacebookIcon },
  tiktok: { label: "TikTok", placeholder: "@yourrestaurant or https://www.tiktok.com/@yourrestaurant", hint: "Your username or the link to your profile", Icon: TikTokIcon },
  x: { label: "X", placeholder: "@yourrestaurant or https://x.com/yourrestaurant", hint: "Your username or the link to your profile (formerly Twitter)", Icon: XIcon },
  whatsapp: { label: "WhatsApp", placeholder: "+383 44 000 000", hint: "The phone number customers can message", Icon: WhatsAppIcon },
  viber: { label: "Viber", placeholder: "+383 44 000 000", hint: "The phone number with country code, or your Viber link", Icon: ViberIcon },
  telegram: { label: "Telegram", placeholder: "@yourrestaurant or +383 44 000 000", hint: "Your username, phone number with country code, or t.me link", Icon: TelegramIcon },
  tripadvisor: { label: "TripAdvisor", placeholder: "https://tripadvisor.com/...", hint: "The link to your TripAdvisor page", Icon: TripAdvisorIcon },
};

export function socialLinkItems(links: SocialLinks) {
  const socialLinks = visibleSocialLinks(links);
  return SOCIAL_PLATFORMS.filter((k) => socialLinks[k]).map((k) => {
    const { label, Icon } = SOCIAL_META[k];
    return { key: k, label, href: makeSocialUrl(k, socialLinks[k]!), icon: <Icon className="w-3.5 h-3.5" /> };
  });
}



/** Row of social media buttons (only the ones the restaurant added) */
export function SocialNav({ socialLinks, className = "" }: { socialLinks: SocialLinks; className?: string }) {
  const links = socialLinkItems(socialLinks);
  if (!links.length) return null;
  return (
    <nav aria-label="Social media" className={`flex items-center justify-center gap-2 flex-wrap ${className}`}>
      {links.map((l) => (
        <a key={l.key} href={l.href} {...(opensApp(l.href) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 transition-colors">
          {l.icon}{l.label}
        </a>
      ))}
    </nav>
  );
}

export function BookViewerPage({ name, menuPdfUrl, socialLinks, backHref, backLabel = "Back", moreFor, feedback = true }: {
  /** Restaurant id or slug: shows the More button (opening hours, leave feedback) */
  moreFor?: string | null;
  /** The restaurant collects feedback */
  feedback?: boolean;
  name: string;
  menuPdfUrl: string | null;
  socialLinks: SocialLinks;
  /** Shows a back link in the top-left corner (menu tree) */
  backHref?: string;
  backLabel?: string;
}) {
  const links = socialLinkItems(socialLinks);
  const pages = parseMenuPages(menuPdfUrl);
  const scroll = pages?.display === "scroll";

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#333333] text-white ${scroll ? "overflow-y-auto" : "overflow-hidden"}`}>
      <h1 className="sr-only">{name} menu</h1>

      {/* Announcements: fixed ones sit here above the menu, the others float over it */}
      {moreFor && <div className="shrink-0"><AnnouncementNotice restaurant={moreFor} inline /></div>}

      <div className="shrink-0 relative min-h-3">
        {backHref && (
          <Link href={backHref}
            className="absolute left-2 top-2 z-10 inline-flex items-center gap-0.5 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full pl-1.5 pr-3 py-1 transition-colors">
            <ChevronLeft className="w-4 h-4" /> {backLabel}
          </Link>
        )}
        {/* Social media (only the ones the restaurant added) */}
        {links.length > 0 ? (
          <nav aria-label="Social media" className={`flex items-center justify-center gap-2 flex-wrap pt-2.5 pb-2 ${backHref ? "px-24" : "px-12"}`}>
            {links.map((l) => (
              <a key={l.key} href={l.href} {...(opensApp(l.href) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 transition-colors">
                {l.icon}{l.label}
              </a>
            ))}
          </nav>
        ) : (
          <div className={backHref ? "h-10" : "h-3"} />
        )}
      </div>

      {/* The book */}
      <main className={scroll ? "flex-1" : "flex-1 min-h-0"}>
        {scroll && pages ? (
          <ScrollMenu pages={pages} />
        ) : menuPdfUrl ? (
          <MenuBook key={menuPdfUrl} source={menuPdfUrl} variant="viewer" height="100%" accentColor="#ffffff" />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-white/70">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">Menu not uploaded yet</p>
          </div>
        )}
      </main>

      {moreFor && <MoreButton restaurant={moreFor} feedback={feedback} />}

      <footer className="shrink-0 py-2.5 text-center">
        <Link href="/" className="text-xs text-white/60 hover:text-white/90 transition-colors">
          Powered by <span className="font-semibold text-white/85">Skano.Menu</span>
        </Link>
      </footer>
    </div>
  );
}
