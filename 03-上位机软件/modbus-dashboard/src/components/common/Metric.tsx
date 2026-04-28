import { cn } from '../../lib/utils';

/**
 * Single labelled telemetry value with optional unit and color tint.
 *
 * Used everywhere small numeric readouts are needed — keep it intentionally
 * dumb so it can be reused across panels.
 */
export function Metric({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[--fg-muted] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-mono font-bold', color || 'text-[--fg-primary]')}>
          {value}
        </span>
        {unit && <span className="text-sm text-[--fg-muted]">{unit}</span>}
      </div>
    </div>
  );
}
