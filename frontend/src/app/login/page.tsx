import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/BrandMark";
import { Alert } from "@/components/ui/Alert";
import { ROLE_HOME } from "@/lib/api/schemas";
import { getCurrentUser } from "@/lib/api/server";
import { cn } from "@/lib/utils";

import { LoginForm } from "./LoginForm";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

// Text column shared by the headline and the footer, so they line up.
const COLUMN = "mx-auto w-full max-w-[72rem] px-[clamp(1.25rem,4vw,3rem)]";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const expired = (await searchParams).expired === "1";
  const me = await getCurrentUser();
  if (me) redirect(ROLE_HOME[me.role]);

  return (
    <main id="main" className="flex min-h-dvh flex-col overflow-x-hidden bg-canvas text-ink">
      <header className={cn(COLUMN, "pt-[clamp(1.25rem,4vh,2.25rem)]")}>
        <BrandMark />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-[clamp(1.25rem,4vh,3rem)] py-[clamp(1rem,3vh,2rem)]">
        <div className={cn(COLUMN, "flex flex-col gap-2")}>
          <p className="max-w-[24ch] text-[1.6rem] leading-[1.1] font-bold tracking-[-0.025em] text-balance sm:text-[clamp(2rem,5.5vh,3rem)]">
            Aphasia practice at home, guided by your care team.
          </p>
          <p className="text-[clamp(1.05rem,2.4vh,1.2rem)] text-ink-muted">
            Patients, family, clinicians and admins all sign in here.
          </p>
        </div>

        {/* The wristband: a slim strap across the page, with the label clipped onto it. */}
        <div className={cn(COLUMN, "relative")}>
          <div
            aria-hidden="true"
            className={cn(
              "strap",
              s.fasten,
              "absolute inset-y-0 left-[clamp(1.25rem,4vw,3rem)] right-[-100vw] my-auto hidden h-24 items-center rounded-l-full pl-4 lg:flex",
            )}
          >
            <span className={cn("strap-stud", s.press, "size-14 shrink-0 rounded-full")} />
          </div>

          <section
            aria-labelledby="sign-in-heading"
            className="relative rounded-card border border-line bg-surface p-[clamp(1.25rem,2.5vw,2rem)] shadow-float sm:max-w-[30rem] lg:ml-28"
          >
            <h1
              id="sign-in-heading"
              className="text-[clamp(1.75rem,4vh,2.25rem)] leading-tight font-bold tracking-tight"
            >
              Sign in
            </h1>
            <p className="text-lg text-ink-muted">Welcome back. Take your time.</p>

            {expired && (
              <div className="mt-4">
                <Alert tone="info">
                  You were signed out after a break, to keep your account
                  safe. Please sign in again; your practice is saved.
                </Alert>
              </div>
            )}

            <div className="mt-4">
              <LoginForm />
            </div>
          </section>
        </div>

        <div className={cn(COLUMN, "flex flex-col gap-1 text-base text-ink-muted md:flex-row md:justify-between md:gap-8")}>
          <p>Trouble signing in? Ask your care team for help.</p>
          <p>Research prototype, not a diagnostic tool. Your clinician is always the authority.</p>
        </div>
      </div>
    </main>
  );
}
