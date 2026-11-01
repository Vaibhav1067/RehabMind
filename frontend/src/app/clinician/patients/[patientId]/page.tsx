import {
  ChartLine,
  ClipboardList,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ConstraintSummary } from "@/components/clinician/ConstraintSummary";
import { EmptyState } from "@/components/clinician/EmptyState";
import {
  AnswersBySessionChart,
  DifficultyBySessionChart,
} from "@/components/clinician/TrendCharts";
import { Facts, Section } from "@/components/clinician/Section";
import { StatusBadge } from "@/components/clinician/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { buttonClasses } from "@/components/ui/Button";
import {
  AIStatusSchema,
  ScriptSummarySchema,
  ConstraintVersionSchema,
  PatientOverviewSchema,
  ProgressSummarySchema,
  TrendPointSchema,
} from "@/lib/api/clinician";
import { MOODS } from "@/lib/moods";
import { MoodDaySchema } from "@/lib/api/schemas";
import { backendGet } from "@/lib/api/server";
import {
  DIFFICULTY_RATING,
  daysSince,
  errorType,
  formatDate,
  formatDateTime,
  formatMs,
  percent,
  responseMode,
} from "@/lib/format";

import { ProgressSummaryCard } from "./ProgressSummaryCard";
import { ResetProgress } from "./ResetProgress";

export const metadata: Metadata = { title: "Patient overview" };

const MIN_TREND_SESSIONS = 2;

export default async function PatientOverviewPage({
  params,
}: PageProps<"/clinician/patients/[patientId]">) {
  const { patientId } = await params;
  const [ov, trend, versions, aiSummary, aiStatus, phrases, moods] =
    await Promise.all([
      backendGet(`/patients/${patientId}/overview`, PatientOverviewSchema),
      backendGet(`/patients/${patientId}/trends`, z.array(TrendPointSchema)),
      backendGet(
        `/patients/${patientId}/constraints/versions`,
        z.array(ConstraintVersionSchema),
      ),
      backendGet(
        `/patients/${patientId}/progress-summary`,
        ProgressSummarySchema.nullable(),
      ),
      backendGet("/ai/status", AIStatusSchema),
      backendGet(
        `/patients/${patientId}/phrases`,
        z.array(ScriptSummarySchema),
      ),
      backendGet(`/patients/${patientId}/moods`, z.array(MoodDaySchema)),
    ]);
  if (!ov) notFound();
  const lowDays = (moods ?? []).filter(
    (m) => m.mood === "low" && (daysSince(m.day) ?? 99) < 7,
  ).length;
  const practisedPhrases = (phrases ?? []).filter((p) => p.times_total > 0);
  const active = versions?.[0];
  const o = ov.outcomes;
  const errors = Object.entries(ov.error_profile)
    .filter(([t]) => t !== "correct")
    .sort((a, b) => b[1] - a[1]);
  const attempted = o.correct + o.near_miss + o.incorrect + o.skipped;
  const base = `/clinician/patients/${patientId}`;

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">{ov.display_name}: overview</h1>

      {ov.last_reset && (
        <Alert tone="info">
          <strong>Fresh start on {formatDateTime(ov.last_reset.at)}</strong>
          {ov.last_reset.by && <> by {ov.last_reset.by}</>}: &ldquo;
          {ov.last_reset.reason}&rdquo;. Figures below count practice since
          then; earlier sessions stay in the session history.
        </Alert>
      )}

      <Section
        id="activity"
        title="Practice activity"
        description={
          ov.last_session_at
            ? `All recorded sessions, ${formatDate(ov.first_session_at!)} to ${formatDate(ov.last_session_at)}.`
            : undefined
        }
      >
        {ov.sessions_total === 0 ? (
          <EmptyState
            icon={ChartLine}
            title="No practice recorded yet"
            action={
              active
                ? undefined
                : {
                    href: `${base}/constraints`,
                    label: "Set practice limits first",
                  }
            }
          >
            Activity appears here after the patient completes their first
            exercise.
          </EmptyState>
        ) : (
          <>
            <Facts
              items={[
                {
                  label: "Sessions completed",
                  value: ov.sessions_completed,
                  hint: `${ov.sessions_stopped_early} stopped early${ov.has_active_session ? " · 1 in progress" : ""}`,
                },
                {
                  label: "Correct",
                  value: percent(o.correct, attempted),
                  hint: `${o.correct} of ${attempted} · ${o.near_miss} close`,
                },
                {
                  label: "Current working level",
                  value: ov.current_working_difficulty ?? "—",
                  hint: "Set by the progression rule, within limits",
                },
                {
                  label: "Median time to answer",
                  value: formatMs(ov.median_latency_ms),
                  hint: "Skipped answers excluded",
                },
              ]}
            />
            <details className="print-open">
              <summary className="min-h-target cursor-pointer py-2 font-bold text-accent">
                More figures
              </summary>
              <dl className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {[
                  [
                    "Incorrect or skipped",
                    `${o.incorrect} incorrect · ${o.skipped} skipped`,
                  ],
                  [
                    "Answers after a hint",
                    `${ov.hinted_responses}. Correct-with-hint holds the level`,
                  ],
                  [
                    "How sessions felt (patient)",
                    Object.entries(ov.difficulty_ratings)
                      .map(([r, n]) => `${DIFFICULTY_RATING[r] ?? r}: ${n}`)
                      .join(" · ") || "No ratings yet",
                  ],
                  [
                    "Naming errors",
                    errors
                      .map(([t, n]) => `${errorType(t)}: ${n}`)
                      .join(" · ") || "No naming errors yet",
                  ],
                  [
                    "Answer methods",
                    ov.by_mode
                      .map(
                        (m) =>
                          `${responseMode(m.mode)}: ${m.correct}/${m.attempted} correct`,
                      )
                      .join(" · ") +
                      (ov.uncertain_speech_matches
                        ? ` · ${ov.uncertain_speech_matches} speech answer(s) to check`
                        : "") +
                      (ov.speech_misheard
                        ? ` · ${ov.speech_misheard} misheard (the patient said no)`
                        : "") || "None yet",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-ink-muted">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
            {trend && trend.length >= MIN_TREND_SESSIONS ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <AnswersBySessionChart trend={trend} />
                <DifficultyBySessionChart trend={trend} />
              </div>
            ) : (
              <EmptyState
                icon={ChartLine}
                title="Not enough sessions for trends yet"
              >
                Trends appear once at least {MIN_TREND_SESSIONS} sessions
                include answers.
              </EmptyState>
            )}
          </>
        )}
      </Section>

      <Section
        id="phrases"
        title="Everyday phrases"
        description="Last 14 days. Lines said are the patient's own report."
      >
        {practisedPhrases.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {practisedPhrases.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3"
              >
                <span className="font-bold">{p.title}</span>
                <span className="text-ink-muted tabular-nums">
                  {p.times_recent} {p.times_recent === 1 ? "time" : "times"}
                  {p.lines_said_share !== null &&
                    ` · ${Math.round(p.lines_said_share * 100)}% of lines said`}
                  {p.last_practised &&
                    ` · last ${formatDate(p.last_practised)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">No everyday phrases practised yet.</p>
        )}
      </Section>

      <Section
        id="wellbeing"
        title="Wellbeing"
        description="How the patient said they felt, last 14 days."
      >
        {moods && moods.length ? (
          <div className="flex flex-col gap-3">
            {lowDays >= 3 && (
              <div>
                <StatusBadge tone="warning">
                  Low mood on {lowDays} of the last 7 days
                </StatusBadge>
              </div>
            )}
            <ol className="flex flex-wrap gap-2">
              {moods.map((m) => {
                const { Icon, label } =
                  MOODS.find((x) => x.mood === m.mood) ?? MOODS[1];
                return (
                  <li
                    key={m.day}
                    className="flex w-24 flex-col items-center gap-1 py-1"
                  >
                    <Icon
                      aria-hidden="true"
                      size={22}
                      className={
                        m.mood === "low"
                          ? "text-warning"
                          : m.mood === "good"
                            ? "text-success"
                            : "text-ink-muted"
                      }
                    />
                    <span className="text-xs text-ink-muted">
                      {formatDate(m.day)}
                    </span>
                    <span className="sr-only">{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <p className="text-ink-muted">No check-ins yet.</p>
        )}
      </Section>

      <Section
        id="limits"
        title="Current practice limits"
        description="Every exercise stays inside these."
        action={
          <Link
            href={`${base}/constraints`}
            className={`${buttonClasses("secondary")} no-print`}
          >
            {active ? "Review or create new version" : "Set practice limits"}
          </Link>
        }
      >
        {active ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="success">
                Active: version {active.version}
              </StatusBadge>
              <span className="text-sm text-ink-muted">
                Created {formatDateTime(active.created_at)} by{" "}
                {active.created_by}
              </span>
            </div>
            <ConstraintSummary constraints={active} />
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No practice limits set"
            action={{
              href: `${base}/constraints`,
              label: "Set practice limits",
            }}
          >
            The patient cannot start practice until a clinician sets limits.
          </EmptyState>
        )}
      </Section>

      <Section
        id="ai-summary"
        title="AI progress summary"
      >
        <ProgressSummaryCard
          patientId={patientId}
          initial={aiSummary}
          status={aiStatus}
        />
      </Section>

      <Section
        id="fresh-start"
        title="Fresh start"
        description="For a new therapy block. Nothing is deleted, and the reset is recorded."
      >
        <ResetProgress patientId={patientId} patientName={ov.display_name} />
      </Section>
    </div>
  );
}
