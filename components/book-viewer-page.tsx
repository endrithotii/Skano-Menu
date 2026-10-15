"use client";

// Full-screen public viewer for a PDF / photo menu: social links on top, the book in the middle,
// page-turn tabs on the screen edges, "Powered by Skano.Menu" below.
// Used for the single book menu and for the menus opened from a menu tree.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { MenuBook, renderPdfToImages } from "@/components/menu-book";
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
  /** Linked but not shown above the menu (set on the Social media page) */
  hidden?: string[];
}

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "whatsapp", "tripadvisor"] as const;
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

function makeSocialUrl(platform: "instagram" | "facebook" | "tripadvisor", value: string): string {
  if (!value) return "#";
  if (value.startsWith("http")) return value;
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tripadvisor: "https://tripadvisor.com/",
  };
  return (bases[platform] ?? "https://") + value;
}

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

/** Name, icon and example of each platform (for the Social media page) */
export const SOCIAL_META: Record<SocialPlatform, { label: string; placeholder: string; hint: string; Icon: (p: { className?: string }) => React.ReactElement }> = {
  instagram: { label: "Instagram", placeholder: "yourrestaurant or https://instagram.com/yourrestaurant", hint: "Your username or the link to your profile", Icon: InstagramIcon },
  facebook: { label: "Facebook", placeholder: "yourrestaurant or https://facebook.com/yourrestaurant", hint: "Your page name or the link to your page", Icon: FacebookIcon },
  whatsapp: { label: "WhatsApp", placeholder: "+383 44 000 000", hint: "The phone number customers can message", Icon: WhatsAppIcon },
  tripadvisor: { label: "TripAdvisor", placeholder: "https://tripadvisor.com/...", hint: "The link to your TripAdvisor page", Icon: TripAdvisorIcon },
};

export function socialLinkItems(links: SocialLinks) {
  const socialLinks = visibleSocialLinks(links);
  return [
    socialLinks.instagram && { key: "instagram", label: "Instagram", href: makeSocialUrl("instagram", socialLinks.instagram), icon: <InstagramIcon className="w-3.5 h-3.5" /> },
    socialLinks.facebook && { key: "facebook", label: "Facebook", href: makeSocialUrl("facebook", socialLinks.facebook), icon: <FacebookIcon className="w-3.5 h-3.5" /> },
    socialLinks.whatsapp && { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/${socialLinks.whatsapp.replace(/\D/g, "")}`, icon: <WhatsAppIcon className="w-3.5 h-3.5" /> },
    socialLinks.tripadvisor && { key: "tripadvisor", label: "TripAdvisor", href: makeSocialUrl("tripadvisor", socialLinks.tripadvisor), icon: <TripAdvisorIcon className="w-3.5 h-3.5" /> },
  ].filter(Boolean) as { key: string; label: string; href: string; icon: React.ReactNode }[];
}



/** Row of social media buttons (only the ones the restaurant added) */
export function SocialNav({ socialLinks, className = "" }: { socialLinks: SocialLinks; className?: string }) {
  const links = socialLinkItems(socialLinks);
  if (!links.length) return null;
  return (
    <nav aria-label="Social media" className={`flex items-center justify-center gap-2 flex-wrap ${className}`}>
      {links.map((l) => (
        <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 transition-colors">
          {l.icon}{l.label}
        </a>
      ))}
    </nav>
  );
}

export function BookViewerPage({ name, menuPdfUrl, socialLinks, backHref, backLabel = "Back" }: {
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
              <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer"
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

      <footer className="shrink-0 py-2.5 text-center">
        <Link href="/" className="text-xs text-white/60 hover:text-white/90 transition-colors">
          Powered by <span className="font-semibold text-white/85">Skano.Menu</span>
        </Link>
      </footer>
    </div>
  );
}
