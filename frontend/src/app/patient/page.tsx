import {
  ArrowRight,
  Image as ImageIcon,
  Lightbulb,
  MessageSquareText,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { KeepGoing } from "@/components/patient/KeepGoing";
import { TalkLink } from "@/components/patient/TalkLink";
import { PatientGoals } from "@/components/patient/PatientGoals";
import { WeekActivity } from "@/components/patient/WeekActivity";
import { buttonClasses } from "@/components/ui/Button";
import {
  GoalListSchema,
  MessageListSchema,
  PracticeActivitySchema,
  PracticeStatusSchema,
} from "@/lib/api/schemas";
import { backendGet, requireRole } from "@/lib/api/server";

export const metadata: Metadata = { title: "Home" };

const NEWCOMER_SESSIONS = 3;

const STEPS = [
  {
    icon: ImageIcon,
    title: "Look at the picture",
    text: "Take as long as you need.",
  },
  {
    icon: MessageSquareText,
    title: "Give your answer",
    text: "Type it, tap the words or say it.",
  },
  {
    icon: Lightbulb,
    title: "Ask for a hint",
    text: "Hints are there whenever you want one.",
  },
];

export default async function PatientHome() {
  const me = await requireRole("patient");
  const [status, activity, goals, messages] = await Promise.all([
    backendGet("/practice/status", PracticeStatusSchema),
    backendGet("/practice/activity", PracticeActivitySchema),
    backendGet("/practice/goals", GoalListSchema),
    backendGet("/practice/messages", MessageListSchema),
  ]);
  const note = messages?.[0];

  const newcomer = (activity?.sessions_completed ?? 0) < NEWCOMER_SESSIONS;
  const cta = `${buttonClasses("primary", "lg")} w-full whitespace-nowrap sm:w-fit`;

  // One screen, no scrolling: the one thing to do takes the height that is left, the
  // practice calendar keeps its own.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <section
        aria-labelledby="today-heading"
        className="flex shrink-0 flex-col gap-6 md:flex-1 md:flex-row md:items-center md:justify-between md:gap-12"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl short:sm:text-3xl">
            Hello, {me.display_name}
          </h1>
          <h2 id="today-heading" className="sr-only">
            Today&rsquo;s practice
          </h2>
          {status?.has_plan &&
          status.resumable &&
          !status.has_active_session ? (
            <KeepGoing
              sessionId={status.resumable.session_id}
              answered={status.resumable.answered}
            />
          ) : status?.has_plan ? (
            <>
              {/* A note from family takes the place of the usual line: it means more. */}
              {note ? (
                <figure className="max-w-md">
                  <blockquote className="line-clamp-2 text-xl">
                    {note.text}
                  </blockquote>
                  <figcaption className="text-ink-muted">
                    {note.author}, your {note.relationship}
                  </figcaption>
                </figure>
              ) : (
                <p className="max-w-md text-xl text-ink-muted">
                  {status.has_active_session
                    ? "Pick up where you left off."
                    : "A few pictures to name. Go at your own pace."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href="/patient/practice" className={cta}>
                  {status.has_active_session
                    ? "Continue practice"
                    : "Start practice"}
                  <ArrowRight aria-hidden="true" size={24} />
                </Link>
                <TalkLink />
              </div>
            </>
          ) : (
            <p className="max-w-md text-xl text-ink-muted">
              Your care team is preparing your practice plan. It will appear
              here.
            </p>
          )}
          {/* For newcomers only: how practice works, in three short steps. */}
          {newcomer && (
            <ol
              aria-label="How practice works"
              className="mt-3 flex flex-col gap-1.5 text-ink-muted"
            >
              {STEPS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-center gap-3">
                  <Icon aria-hidden="true" size={20} className="shrink-0" />
                  <span>
                    <strong className="text-ink">{title}.</strong> {text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {goals && goals.length > 0 && <PatientGoals goals={goals} />}
      </section>

      {activity && <WeekActivity activity={activity} checkIn />}
    </div>
  );
}
