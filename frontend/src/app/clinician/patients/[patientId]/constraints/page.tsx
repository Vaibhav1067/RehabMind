import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ConstraintSummary } from "@/components/clinician/ConstraintSummary";
import { EmptyState } from "@/components/clinician/EmptyState";
import { Section } from "@/components/clinician/Section";
import { StatusBadge } from "@/components/clinician/StatusBadge";
import {
  ConstraintOptionsSchema,
  ConstraintVersionSchema,
  PatientOverviewSchema,
  type ConstraintVersion,
} from "@/lib/api/clinician";
import { GoalListSchema, PersonalWordSchema } from "@/lib/api/schemas";
import { OwnWords } from "@/components/OwnWords";
import { backendGet } from "@/lib/api/server";
import { formatDateTime } from "@/lib/format";

import { ConstraintEditor } from "./ConstraintEditor";
import { GoalsPanel } from "./GoalsPanel";
import { VersionCompare } from "./VersionCompare";

export const metadata: Metadata = { title: "Plan" };

// The history can grow long; the newest few are listed, the rest behind "Show all".
const RECENT_VERSIONS = 6;
const COMPARE_VERSIONS = 20;

function VersionRow({ v }: { v: ConstraintVersion }) {
  return (
    <li>
      <details className="py-1">
        <summary className="flex min-h-target cursor-pointer flex-wrap items-center gap-3">
          <span className="font-bold">Version {v.version}</span>
          {v.is_active ? (
            <StatusBadge tone="success">Active</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Superseded</StatusBadge>
          )}
          <span className="text-sm text-ink-muted">
            {formatDateTime(v.created_at)} · {v.created_by} · levels{" "}
            {v.min_difficulty}–{v.max_difficulty}
          </span>
        </summary>
        <div className="flex flex-col gap-3 pt-2 pb-4">
          <ConstraintSummary constraints={v} />
          {v.note && <p className="text-ink-muted">Note: {v.note}</p>}
        </div>
      </details>
    </li>
  );
}

export default async function ConstraintsPage({
  params,
  searchParams,
}: PageProps<"/clinician/patients/[patientId]/constraints">) {
  const { patientId } = await params;
  const showAll = (await searchParams).history === "all";
  const [versions, options, goals, words, overview] = await Promise.all([
    backendGet(
      `/patients/${patientId}/constraints/versions`,
      z.array(ConstraintVersionSchema),
    ),
    backendGet("/clinical/constraint-options", ConstraintOptionsSchema),
    backendGet(`/patients/${patientId}/goals`, GoalListSchema),
    backendGet(
      `/patients/${patientId}/personal-words`,
      z.array(PersonalWordSchema),
    ),
    backendGet(`/patients/${patientId}/overview`, PatientOverviewSchema),
  ]);
  if (!versions || !options || !goals || !words || !overview) notFound();
  const active = versions.find((v) => v.is_active) ?? null;

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">Plan</h1>

      <Section
        id="goals"
        title="Goals"
        description="Shown to the patient, with progress from their practice."
      >
        <GoalsPanel patientId={patientId} goals={goals} />
      </Section>

      <Section
        id="own-words"
        title="Own words"
        description="Photos of the patient's people, pets and things, practised with the catalogue pictures."
      >
        <OwnWords
          apiBase={`/patients/${patientId}/personal-words`}
          patientName={overview.display_name}
          words={words}
        />
      </Section>

      <Section
        id="active"
        title="Practice limits"
        description="Every exercise stays inside these. Changes create a new version; old versions are kept."
      >
        {active ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="success">
                Version {active.version} · active
              </StatusBadge>
              <span className="text-sm text-ink-muted">
                Created {formatDateTime(active.created_at)} by{" "}
                {active.created_by}
              </span>
            </div>
            <ConstraintSummary constraints={active} />
            {active.note && (
              <p className="text-ink-muted">Note: {active.note}</p>
            )}
          </div>
        ) : (
          <EmptyState icon={History} title="No practice limits yet">
            The patient cannot start practice until limits are set.
          </EmptyState>
        )}
        <ConstraintEditor
          patientId={patientId}
          current={active}
          options={options}
        />
      </Section>

      {versions.length > 0 && (
        <Section
          id="history"
          title="Version history"
          description="Every version the patient has had, newest first."
        >
          {versions.length > 1 && (
            <VersionCompare
              versions={
                showAll ? versions : versions.slice(0, COMPARE_VERSIONS)
              }
            />
          )}
          <ol className="divide-y divide-line border-y border-line">
            {(showAll ? versions : versions.slice(0, RECENT_VERSIONS)).map(
              (v) => (
                <VersionRow key={v.id} v={v} />
              ),
            )}
          </ol>
          {!showAll && versions.length > RECENT_VERSIONS && (
            <Link
              href="?history=all#history"
              className="w-fit py-2 font-bold text-accent underline-offset-4 hover:underline"
            >
              Show all {versions.length} versions
            </Link>
          )}
        </Section>
      )}
    </div>
  );
}
