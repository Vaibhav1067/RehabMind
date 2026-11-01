import type { ReactNode } from "react";

/** Titled content region; headings give screen-reader users a navigable outline. */
export function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="text-xl font-bold">
            {title}
          </h2>
          {description && (
            <p className="text-base text-ink-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Headline figures as type: label above value, no boxes and no icons. */
export function Facts({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
      {items.map(({ label, value, hint }) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
          {hint && <dd className="text-sm text-ink-muted">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
