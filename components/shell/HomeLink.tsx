"use client";

import Link from "next/link";
import { HOME_RESET_EVENT } from "@/components/lookup/session";

/**
 * The header's site-name link (S06 review). On '/' a result is component state, so a same-URL soft navigation would
 * change nothing; there the link asks the lookup island to return to an empty form instead.
 */
export function HomeLink({ className, children }: { readonly className: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <Link
      href="/"
      className={className}
      onClick={(event) => {
        if (window.location.pathname !== "/") return;
        event.preventDefault();
        window.dispatchEvent(new Event(HOME_RESET_EVENT));
        window.scrollTo(0, 0);
      }}
    >
      {children}
    </Link>
  );
}
