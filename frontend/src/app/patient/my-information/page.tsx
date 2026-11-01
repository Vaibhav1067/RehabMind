import { ArrowLeft, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";
import { WhoCanSeeSchema } from "@/lib/api/schemas";
import { backendGet } from "@/lib/api/server";

import { StopSharing } from "./StopSharing";

export const metadata: Metadata = { title: "My information" };

export default async function MyInformation() {
  const who = await backendGet("/practice/my-information", WhoCanSeeSchema);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">My information</h1>
        <Link
          href="/patient"
          className="inline-flex min-h-target items-center gap-2 font-bold text-ink-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" size={20} />
          Home
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-x-12 gap-y-8 lg:grid-cols-2">
        <section
          aria-labelledby="who-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="who-heading" className="text-xl font-bold">
            Who can see your practice
          </h2>
          <div className="flex flex-col gap-2">
            <p className="font-bold">Your care team</p>
            <p className="text-ink-muted">
              {who?.care_team.length
                ? `${who.care_team.join(", ")}: your answers and progress, to plan your practice.`
                : "No one yet."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-bold">Your family</p>
            <p className="text-ink-muted">
              How often you practise and your goals. Never your answers.
            </p>
            {who?.family.length ? (
              <ul className="flex flex-col">
                {who.family.map((f) => (
                  <li
                    key={f.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2"
                  >
                    <span>
                      <strong>{f.name}</strong>{" "}
                      <span className="text-ink-muted">({f.relationship})</span>
                    </span>
                    <StopSharing userId={f.user_id} name={f.name} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">No family members are linked.</p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="kept-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="kept-heading" className="text-xl font-bold">
            What is kept
          </h2>
          <ul className="flex flex-col gap-3 text-lg">
            <li>
              Your answers, as text, and how practice went.
            </li>
            <li>
              Your voice recordings are deleted straight after they are turned
              into words.
            </li>
            <li>
              Photos of your own words are locked: only you, your family and
              your care team can see them.
            </li>
          </ul>
          <a
            href="/api/v1/practice/my-information/export"
            download
            className={`${buttonClasses("secondary")} w-fit`}
          >
            <Download aria-hidden="true" size={20} />
            Download my information
          </a>
        </section>
      </div>
      <Link
        href="/credits"
        className="inline-flex min-h-target shrink-0 items-center self-start text-sm text-ink-muted underline underline-offset-4 hover:text-ink sm:hidden"
      >
        Photo credits
      </Link>
    </div>
  );
}
