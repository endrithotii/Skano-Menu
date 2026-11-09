"use client";

// A small round photo of a person, or their first letter when they have no photo.
// Photos come from /api/account/photo, loaded once and shared by every avatar on the page.

import { useEffect, useState, useSyncExternalStore } from "react";

type Photos = { mine: string | null; people: Record<string, string> };

let photos: Photos = { mine: null, people: {} };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(force = false) {
  if (loading && !force) return loading;
  loading = fetch("/api/account/photo", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { photos = { mine: d.mine ?? null, people: d.people ?? {} }; emit(); } })
    .catch(() => {});
  return loading;
}

/** After uploading or removing your photo: show the new one everywhere */
export function setMyPhoto(userId: string | undefined, url: string | null) {
  const people = { ...photos.people };
  if (userId) { if (url) people[userId] = url; else delete people[userId]; }
  photos = { mine: url, people };
  emit();
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const snapshot = () => photos;
const serverSnapshot = (): Photos => ({ mine: null, people: {} });

/** Everyone's photos (and yours), kept up to date */
export function usePhotos(): Photos {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

const SIZES = { xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-16 h-16 text-2xl", xl: "w-20 h-20 text-3xl" } as const;

/**
 * userId: whose photo. me: your own photo (when you don't know your id).
 * name: for the first letter and the description of the photo.
 */
export function UserAvatar({ userId, me = false, name, size = "sm", className = "" }: {
  userId?: string; me?: boolean; name?: string | null; size?: keyof typeof SIZES; className?: string;
}) {
  const p = usePhotos();
  const url = me ? p.mine : userId ? p.people[userId] : undefined;
  const [broken, setBroken] = useState<string | null>(null);
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const box = `${SIZES[size]} shrink-0 rounded-full overflow-hidden ${className}`;

  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small photo from our own storage, no resizing needed
      <img src={url} alt={name ? `Photo of ${name}` : "Profile photo"} className={`${box} object-cover bg-gray-100 ring-1 ring-black/5`}
        onError={() => setBroken(url)} loading="lazy" />
    );
  }
  return (
    <span aria-hidden className={`${box} bg-blue-50 text-blue-700 font-bold flex items-center justify-center`}>{letter}</span>
  );
}
