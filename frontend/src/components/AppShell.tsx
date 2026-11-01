import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/SignOutButton";
import { SkipLink } from "@/components/ui/SkipLink";

/** Shared page frame: one predictable header, one main region. */
export function AppShell({
  name,
  roleLabel,
  wide = false,
  fit = false,
  children,
}: {
  name: string;
  roleLabel?: string;
  /** true: the clinician and admin consoles; false: the patient's area. */
  wide?: boolean;
  /**
   * true (the patient's area): exactly one screen tall. Each page lays itself out in the
   * height that is left, so nothing needs scrolling; main only scrolls as a last resort on
   * very small screens. Credits move into the header (on a phone, My information has them).
   */
  fit?: boolean;
  children: ReactNode;
}) {
  const width = wide ? "max-w-6xl" : "max-w-5xl";
  const credits = (
    <Link
      href="/credits"
      className="inline-flex min-h-target items-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
    >
      Photo credits
    </Link>
  );
  return (
    <div className={fit ? "flex h-dvh flex-col" : "contents"}>
      <SkipLink />
      <header
        className={`z-40 border-b border-line bg-accent-soft ${fit ? "shrink-0" : "sticky top-0"}`}
      >
        <div
          className={`mx-auto flex ${width} items-center justify-between gap-3 px-4 py-2 sm:gap-4 sm:px-6`}
        >
          <p className="flex items-center gap-3">
            <BrandMark />
            {roleLabel && (
              <span className="hidden border-l border-accent/30 pl-3 text-base text-ink-muted sm:inline">
                {roleLabel}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3 sm:gap-5">
            {fit ? (
              <>
                <Link
                  href="/patient/my-information"
                  className="inline-flex min-h-target items-center text-center text-sm leading-tight text-ink-muted underline underline-offset-4 hover:text-ink"
                >
                  My information
                </Link>
                <span className="hidden sm:contents">{credits}</span>
              </>
            ) : (
              <span className="hidden font-bold sm:inline">{name}</span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main
        id="main"
        // In the one-screen area main can scroll as a last resort: keyboard users must reach it.
        tabIndex={fit ? 0 : -1}
        className={
          fit
            ? `mx-auto flex min-h-0 w-full ${width} flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6`
            : `mx-auto w-full ${width} flex-1 px-6 py-8 sm:py-12`
        }
      >
        {children}
      </main>
      {!fit && (
        <footer className={`mx-auto w-full ${width} px-6 pb-6`}>
          {credits}
        </footer>
      )}
    </div>
  );
}
