import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/Button";

/** Nothing to show yet: what is missing, why, and (when there is one) the next step. */
export function EmptyState({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Icon aria-hidden="true" size={28} className="text-ink-muted" />
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-prose text-ink-muted">{children}</div>}
      {action && (
        <Link href={action.href} className={`mt-2 ${buttonClasses("primary")}`}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
