import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Generic card container used by every dashboard panel.
 *
 * Layout: bordered title row at top, padded body below. Caller controls
 * grid sizing through `className`.
 */
export function Card({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-[--border] bg-[--bg-card] overflow-hidden', className)}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[--border]">
        {icon}
        <h2 className="text-base font-semibold text-[--fg-primary]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
