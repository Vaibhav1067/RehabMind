import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/clinician/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import {
  PatientListItemSchema,
  type PatientListItem,
} from "@/lib/api/clinician";
import { backendGet, requireRole } from "@/lib/api/server";
import { daysSince, responseMode } from "@/lib/format";

export const metadata: Metadata = { title: "Patients" };

const RECENT_DAYS = 7;
// Below this share correct, practice is mostly frustration (productive band 60-90%,
// docs/validation/personalization.md). Needs enough answers not to flag one bad day.
const STRUGGLING_BELOW = 0.4;
const STRUGGLING_MIN_ANSWERS = 10;

/** Why a patient needs the clinician's attention, if they do (most urgent first). */
function attention(p: PatientListItem): string | null {
  if (!p.constraints) return "No practice limits yet: practice cannot start";
  const days = daysSince(p.last_session_at);
  if (days === null) return "Has not practised yet";
  if (days >= RECENT_DAYS) return `No practice for ${days} days`;
  if (
    p.recent_responses >= STRUGGLING_MIN_ANSWERS &&
    p.recent_correct / p.recent_responses < STRUGGLING_BELOW
  )
    return "Struggling: consider easier practice limits";
  return null;
}

function lastPractice(p: PatientListItem) {
  const days = daysSince(p.last_session_at);
  if (days === null) return "No sessions yet";
  if (days === 0) return "Practised today";
  if (days === 1) return "Practised yesterday";
  return `Last practised ${days} days ago`;
}

function PatientRow({ p }: { p: PatientListItem }) {
  const reason = attention(p);
  return (
    <li className="relative grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={p.display_name} />
        <div className="min-w-0">
          {/* The name is the link; its hit area covers the whole row. */}
          <Link
            href={`/clinician/patients/${p.id}`}
            className="text-lg font-bold text-ink after:absolute after:inset-0 after:content-[''] hover:text-accent"
          >
            {p.display_name}
          </Link>
          <p className="text-sm">
            {reason ? (
              <span className="font-bold text-warning">{reason}</span>
            ) : (
              <span className="text-ink-muted">
                {lastPractice(p)} · {p.sessions_completed}{" "}
                {p.sessions_completed === 1 ? "session" : "sessions"}
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-ink-muted tabular-nums">
        {p.recent_responses
          ? `${p.recent_correct} of last ${p.recent_responses} correct`
          : "No answers yet"}
      </p>

      {p.constraints ? (
        <p className="text-ink-muted">
          Levels {p.constraints.min_difficulty}–{p.constraints.max_difficulty} ·{" "}
          {p.constraints.allowed_response_modes.map(responseMode).join(", ")}
        </p>
      ) : (
        <Link
          href={`/clinician/patients/${p.id}/constraints`}
          className="relative inline-flex min-h-target w-fit items-center font-bold text-accent underline underline-offset-4"
        >
          Set practice limits
        </Link>
      )}

      <ChevronRight
        aria-hidden="true"
        size={20}
        className="hidden text-ink-muted sm:block"
      />
    </li>
  );
}

export default async function ClinicianDashboard() {
  await requireRole("clinician");
  const patients =
    (await backendGet(
      "/clinicians/me/patients",
      z.array(PatientListItemSchema),
    )) ?? [];
  const flagged = patients.filter((p) => attention(p)).length;
  // Patients who need something first, then the most recently active.
  const ordered = [...patients].sort(
    (a, b) =>
      Number(!attention(a)) - Number(!attention(b)) ||
      (daysSince(a.last_session_at) ?? Infinity) -
        (daysSince(b.last_session_at) ?? Infinity),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your patients</h1>
        <p className="mt-1 text-base text-ink-muted">
          {patients.length === 0
            ? "No patients assigned yet."
            : flagged
              ? `${flagged} of ${patients.length} ${flagged === 1 ? "needs" : "need"} your attention. Recorded practice, not a clinical assessment.`
              : `${patients.length === 1 ? patients[0].display_name : `All ${patients.length} patients`} practised in the last ${RECENT_DAYS} days. Recorded practice, not a clinical assessment.`}
        </p>
      </div>

      {patients.length === 0 ? (
        <EmptyState icon={Users} title="No patients are assigned to you yet">
          Patients appear here once an administrator adds you to their care
          team.
        </EmptyState>
      ) : (
        <section aria-labelledby="patient-list">
          <h2 id="patient-list" className="sr-only">
            Patients
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {ordered.map((p) => (
              <PatientRow key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
