import { useEffect, useRef } from 'react';

/**
 * Drive a periodic async polling loop while `enabled` is true.
 *
 * The loop is sequential — `pollFn` is awaited before the next interval fires.
 * If `isBusy` returns true the next tick is skipped (used to keep the serial
 * line silent during Flash writes).
 *
 * Returns a mutable `pollingRef` so the caller can also force-stop the loop
 * imperatively (e.g. on disconnect) without waiting for the React effect to
 * tear down.
 */
export function usePolling(opts: {
  enabled: boolean;
  intervalMs: number;
  pollFn: () => Promise<void> | void;
  isBusy?: () => boolean;
}) {
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!opts.enabled) return;
    pollingRef.current = true;
    let cancelled = false;

    const loop = async () => {
      while (pollingRef.current && !cancelled) {
        if (!(opts.isBusy?.() ?? false)) {
          await opts.pollFn();
        }
        await new Promise((r) => setTimeout(r, opts.intervalMs));
      }
    };
    loop();

    return () => {
      cancelled = true;
      pollingRef.current = false;
    };
  }, [opts.enabled, opts.intervalMs, opts.pollFn, opts.isBusy]);

  return { pollingRef };
}
