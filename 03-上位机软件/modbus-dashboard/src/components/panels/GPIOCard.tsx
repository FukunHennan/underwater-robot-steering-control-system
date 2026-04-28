import { Zap } from 'lucide-react';
import { Card } from '../common/Card';
import { cn } from '../../lib/utils';
import { GPIO_LABELS } from '../../lib/presets';
import type { GPIOData } from '../../lib/modbus';

export type IoMessage = { type: 'info' | 'ok' | 'err'; text: string } | null;

/**
 * GPIO control panel for the 4 expansion pins.
 *
 * Each row exposes mode (input/output), output level toggle, and live input
 * indicator. State and handlers come from the parent so this panel stays
 * presentational.
 */
export function GPIOCard({
  gpio,
  connected,
  ioMsg,
  onModeChange,
  onOutputChange,
  onRefresh,
}: {
  gpio: GPIOData | null;
  connected: boolean;
  ioMsg: IoMessage;
  onModeChange: (ch: number, mode: number) => void;
  onOutputChange: (ch: number, value: number) => void;
  onRefresh: () => void;
}) {
  return (
    <Card
      title="GPIO 扩展接口"
      icon={<Zap className="w-4 h-4 text-emerald-400" />}
      className="col-span-12 lg:col-span-7"
    >
      <div className="space-y-3">
        {ioMsg && (
          <div
            className={cn(
              'px-2 py-1 rounded text-[11px] font-mono',
              ioMsg.type === 'ok' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
              ioMsg.type === 'err' && 'bg-red-500/15 text-red-400 border border-red-500/30',
              ioMsg.type === 'info' && 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
            )}
          >
            {ioMsg.text}
          </div>
        )}
        <div className="grid grid-cols-[90px_90px_1fr_1fr] gap-2 items-center text-[10px] text-[--fg-muted] uppercase px-1">
          <div>引脚</div>
          <div>模式</div>
          <div>输出</div>
          <div>输入状态</div>
        </div>
        {GPIO_LABELS.map((label, ch) => (
          <div
            key={label}
            className="grid grid-cols-[90px_90px_1fr_1fr] gap-2 items-center rounded bg-[--bg-input]/40 px-2 py-2"
          >
            <div>
              <div className="text-sm font-mono font-semibold text-[--fg-primary]">{label}</div>
              <div className="text-[10px] text-[--fg-muted]">GPIO{ch}</div>
            </div>
            <select
              value={gpio?.modes[ch] ?? 0}
              onChange={(e) => onModeChange(ch, Number(e.target.value))}
              disabled={!connected}
              className="bg-[--bg-card] border border-[--border] rounded px-2 py-1 text-xs text-[--fg-primary]"
            >
              <option value={0}>输入</option>
              <option value={1}>输出</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOutputChange(ch, 0)}
                disabled={!connected || (gpio?.modes[ch] ?? 0) !== 1}
                className="px-3 py-1 rounded text-xs bg-zinc-500/20 text-zinc-300 hover:bg-zinc-500/30 disabled:opacity-40 transition-colors"
              >
                低
              </button>
              <button
                onClick={() => onOutputChange(ch, 1)}
                disabled={!connected || (gpio?.modes[ch] ?? 0) !== 1}
                className="px-3 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
              >
                高
              </button>
              <span className="text-[10px] font-mono text-[--fg-muted]">
                OUT={gpio?.outputs[ch] ?? '--'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block w-2.5 h-2.5 rounded-full',
                  (gpio?.inputs[ch] ?? 0) ? 'bg-emerald-400' : 'bg-zinc-500',
                )}
              />
              <span className="text-xs font-mono text-[--fg-primary]">{gpio?.inputs[ch] ?? '--'}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            onClick={onRefresh}
            disabled={!connected}
            className="px-3 py-1 rounded text-[11px] font-medium bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 transition-colors"
          >
            刷新 GPIO
          </button>
        </div>
      </div>
    </Card>
  );
}
