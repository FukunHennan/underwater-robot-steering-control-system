import { Settings } from 'lucide-react';
import { Card } from '../common/Card';

export type IRParamsEdit = {
  leadLowLo: string; leadLowHi: string;
  leadHighLo: string; leadHighHi: string;
  bit0Lo: string; bit0Hi: string;
  bit1Lo: string; bit1Hi: string;
};

export type IRMessage = { type: 'info' | 'ok' | 'err'; text: string } | null;

const FIELDS: Array<{ key: keyof IRParamsEdit; label: string }> = [
  { key: 'leadLowLo',  label: '引导码低(下限)' },
  { key: 'leadLowHi',  label: '引导码低(上限)' },
  { key: 'leadHighLo', label: '引导码高(下限)' },
  { key: 'leadHighHi', label: '引导码高(上限)' },
  { key: 'bit0Lo',     label: '数据"0"(下限)' },
  { key: 'bit0Hi',     label: '数据"0"(上限)' },
  { key: 'bit1Lo',     label: '数据"1"(下限)' },
  { key: 'bit1Hi',     label: '数据"1"(上限)' },
];

/**
 * NEC decode timing window editor. Lets advanced users widen/narrow the
 * acceptance ranges per field without touching firmware constants.
 */
export function IRTimingPanel({
  irParamsEdit,
  setIrParamsEdit,
  irMsg,
  connected,
  onRead,
  onApply,
  onReset,
}: {
  irParamsEdit: IRParamsEdit;
  setIrParamsEdit: (updater: (prev: IRParamsEdit) => IRParamsEdit) => void;
  irMsg: IRMessage;
  connected: boolean;
  onRead: () => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <Card
      title="红外解码参数配置"
      icon={<Settings className="w-4 h-4 text-cyan-400" />}
      className="col-span-12 lg:col-span-7"
    >
      <div className="space-y-3">
        <div className="rounded bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-xs text-cyan-300 leading-relaxed">
          调整红外解码 timing 参数范围，用于适配不同品牌的遥控器。修改后点击"应用参数"生效。
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="text-[10px] text-[--fg-muted] uppercase mb-1">{label}</div>
              <input
                type="number"
                value={irParamsEdit[key]}
                onChange={(e) => setIrParamsEdit((p) => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-[--bg-card] border border-[--border] rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          ))}
        </div>
        {irMsg && (
          <div
            className={`rounded px-3 py-2 text-xs ${
              irMsg.type === 'ok'
                ? 'bg-green-500/10 text-green-400'
                : irMsg.type === 'err'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-sky-500/10 text-sky-400'
            }`}
          >
            {irMsg.text}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onRead}
            disabled={!connected}
            className="px-3 py-1 rounded text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 transition-colors"
          >
            从下位机读取
          </button>
          <button
            onClick={onApply}
            disabled={!connected}
            className="px-3 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
          >
            应用参数
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1 rounded text-xs bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
          >
            恢复默认
          </button>
        </div>
      </div>
    </Card>
  );
}
