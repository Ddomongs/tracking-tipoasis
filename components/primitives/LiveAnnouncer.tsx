"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// The page's one polite live region (spec §5, §12; contract §11.9). It is part of the server HTML, so it exists before any announcement.
// Only this component renders aria-live; primitives never do (S05). Error sentences use role="alert" in place instead.

type Announce = (message: string) => void;

/** The region is emptied first and written this much later, so the same sentence twice is read twice. */
const WRITE_AFTER_CLEAR_MS = 60;
const noAnnounce: Announce = () => undefined;

const AnnounceContext = createContext<Announce>(noAnnounce);

export function LiveAnnouncerProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  const announce = useCallback<Announce>((next) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setMessage("");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setMessage(next);
    }, WRITE_AFTER_CLEAR_MS);
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div data-live-region="polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

/** Clears, then sets the region's text (contract §11.9). Outside a provider it does nothing. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
