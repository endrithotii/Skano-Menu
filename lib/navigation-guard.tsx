"use client";

// Warns before leaving a page with unsaved changes.
// - Sidebar / header links in the dashboard ask via confirmLeave() (Link onNavigate)
// - Closing the tab, refreshing or typing a new URL uses the browser's own beforeunload prompt
// Based on the "Blocking navigation" pattern in the Next.js Link docs.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_MESSAGE = "You have unsaved changes. If you leave this page they will be lost. Leave anyway?";

interface NavigationGuardContextValue {
  isBlocked: boolean;
  setBlocked: (blocked: boolean, message?: string) => void;
  /** Returns true when it is OK to leave (nothing unsaved, or the user confirmed) */
  confirmLeave: () => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  isBlocked: false,
  setBlocked: () => {},
  confirmLeave: () => true,
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const messageRef = useRef(DEFAULT_MESSAGE);

  const setBlocked = useCallback((blocked: boolean, message?: string) => {
    messageRef.current = message ?? DEFAULT_MESSAGE;
    setIsBlocked(blocked);
  }, []);

  const confirmLeave = useCallback(() => {
    if (!isBlocked) return true;
    const ok = window.confirm(messageRef.current);
    if (ok) setIsBlocked(false);
    return ok;
  }, [isBlocked]);

  // Browser-level prompt for refresh / close tab / external navigation
  useEffect(() => {
    if (!isBlocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // required by some browsers to show the prompt
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isBlocked]);

  const value = useMemo(() => ({ isBlocked, setBlocked, confirmLeave }), [isBlocked, setBlocked, confirmLeave]);
  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

/** Mark the current page as having unsaved changes while `dirty` is true. */
export function useUnsavedChanges(dirty: boolean, message?: string) {
  const { setBlocked } = useNavigationGuard();
  useEffect(() => {
    setBlocked(dirty, message);
  }, [dirty, message, setBlocked]);
  // Clear when the page unmounts
  useEffect(() => () => setBlocked(false), [setBlocked]);
}
