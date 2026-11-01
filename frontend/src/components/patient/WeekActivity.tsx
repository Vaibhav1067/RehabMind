"use client";

import type { PracticeActivity } from "@/lib/api/schemas";

import { MoodCheckin } from "./MoodCheckin";
import { PracticeCalendar, picturesByDay, weekStart } from "./PracticeCalendar";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The patient's practice: a calendar of the last weeks and two running totals. Activity
 * only (never scores), and no "streak" pressure: a missed day is just empty. A client
 * component so "today" is the patient's own day, not the server's.
 */
export function WeekActivity({
  activity,
  checkIn = false,
  name,
}: {
  activity: PracticeActivity;
  /** The patient's own home: ask how they are today. */
  checkIn?: boolean;
  /** Family see this card about someone else: the patient's name replaces "you". */
  name?: string;
}) {
  const byDay = picturesByDay(activity);
  const today = new Date();
  // "This week" starts on Monday, the same week the patient's goals count.
  const monday = weekStart(today);
  const thisWeek = Array.from({ length: ((today.getDay() + 6) % 7) + 1 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return byDay.get(dayKey(d)) ?? 0;
  });
  const activeDays = thisWeek.filter((n) => n > 0).length;
  const who = name ?? "You";
  const message = byDay.get(dayKey(today))
    ? `${who} practised today. Well done.`
    : activeDays
      ? `${who} practised on ${activeDays} ${activeDays === 1 ? "day" : "days"} this week.`
      : "Every day is a fresh start.";

  return (
    <section
      aria-labelledby="week-heading"
      className="flex shrink-0 flex-col gap-3 border-t border-line pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="week-heading" className="text-xl font-bold">
            {name ? `${name}’s practice` : "Your practice"}
          </h2>
          <p className="text-ink-muted">{message}</p>
        </div>
        {checkIn && <MoodCheckin />}
      </div>
      <PracticeCalendar activity={activity} name={name} />
      <p className="text-ink-muted tabular-nums">
        {activity.pictures_practised}{" "}
        {activity.pictures_practised === 1 ? "picture" : "pictures"} practised ·{" "}
        {activity.sessions_completed}{" "}
        {activity.sessions_completed === 1 ? "session" : "sessions"} finished
      </p>
    </section>
  );
}
