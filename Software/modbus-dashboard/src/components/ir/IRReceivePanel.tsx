import { RadioReceiver } from 'lucide-react';
import { Card } from '../common/Card';
import { IR_STATUS_LABELS } from '../../lib/presets';
import type { IRData } from '../../lib/modbus';

export function IRReceivePanel(props: {
  ir: IRData | null;
  connected: boolean;
  onRefresh: () => void;
  onSaveRx: () => void;
}) {
  const { ir, connected, onRefresh, onSaveRx } = props;
  const rxDataHex = ir ? `0x${ir.rxData.toString(16).toUpperCase().padStart(4, '0')}` : '--';
  const addr = ir ? (ir.rxData >> 8) & 0xff : null;
  const cmd = ir ? ir.rxData & 0xff : null;

  return (
    <Card
      title="红外接收 (NEC)"
      icon={<RadioReceiver className="w-4 h-4 text-emerald-400" />}
      className="col-span-12 lg:col-span-7"
    >
      <div className="space-y-3">
        <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300 leading-relaxed">
          红外接收硬件接在 PE4 / DP2。收到 NEC 帧后会显示状态、地址和命令；调试状态下 TX_CMD 显示边沿计数，TX_DATA 显示最近一次脉宽。
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">接收状态</div>
            <div className="text-lg font-mono font-bold text-emerald-400">
              {ir ? IR_STATUS_LABELS[ir.rxStatus] ?? `${ir.rxStatus}` : '--'}
            </div>
          </div>
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">接收数据</div>
            <div className="text-lg font-mono font-bold text-[--fg-primary]">{rxDataHex}</div>
          </div>
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">地址 ADDR</div>
            <div className="text-lg font-mono font-bold text-sky-400">
              {addr === null ? '--' : `0x${addr.toString(16).toUpperCase().padStart(2, '0')}`}
            </div>
          </div>
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">命令 CMD</div>
            <div className="text-lg font-mono font-bold text-amber-400">
              {cmd === null ? '--' : `0x${cmd.toString(16).toUpperCase().padStart(2, '0')}`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">边沿计数</div>
            <div className="text-lg font-mono font-bold text-[--fg-primary]">{ir ? ir.txCmd : '--'}</div>
          </div>
          <div className="bg-[--bg-input] rounded px-3 py-2">
            <div className="text-[10px] text-[--fg-muted] uppercase">最近脉宽</div>
            <div className="text-lg font-mono font-bold text-[--fg-primary]">{ir ? `${ir.txData} us` : '--'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={!connected}
            className="px-4 py-1.5 rounded text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 transition-colors font-medium"
          >
            刷新接收
          </button>
          <button
            onClick={onSaveRx}
            disabled={!connected || !ir}
            className="px-4 py-1.5 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors font-medium"
          >
            保存接收数据
          </button>
        </div>
      </div>
    </Card>
  );
}
