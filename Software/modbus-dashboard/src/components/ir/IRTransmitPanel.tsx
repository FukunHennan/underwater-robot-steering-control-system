import { Zap } from 'lucide-react';
import { Card } from '../common/Card';
import { IR_PRESETS } from '../../lib/presets';

/**
 * NEC infrared transmit + live-RX status card.
 *
 * Owns no state itself — all editor strings, preset index, and message live
 * in the parent. Address & command are entered as decimal + hex in parallel.
 */
export function IRTransmitPanel(props: {
  connected: boolean;
  irTxAddr: string;
  setIrTxAddr: (v: string) => void;
  irTxAddrHex: string;
  setIrTxAddrHex: (v: string) => void;
  irTxData: string;
  setIrTxData: (v: string) => void;
  irTxCmdHex: string;
  setIrTxCmdHex: (v: string) => void;
  irTxPresetIndex: number;
  setIrTxPresetIndex: (i: number) => void;
  onPresetSelect: (i: number) => void;
  onSend: () => void;
  onRefresh: () => void;
}) {
  const {
    connected,
    irTxAddr, setIrTxAddr, irTxAddrHex, setIrTxAddrHex,
    irTxData, setIrTxData, irTxCmdHex, setIrTxCmdHex,
    irTxPresetIndex,
    setIrTxPresetIndex, onPresetSelect, onSend, onRefresh,
  } = props;

  return (
    <Card
      title="红外发射 (NEC)"
      icon={<Zap className="w-4 h-4 text-amber-400" />}
      className="col-span-12 lg:col-span-5"
    >
      <div className="space-y-3">
        <div className="rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300 leading-relaxed">
          红外发射已实现 NEC 协议，支持预设命令和自定义发送。选择预设或输入地址/命令后点击发送。
        </div>

        {/* Preset Selection */}
        <div>
          <div className="text-[10px] text-[--fg-muted] uppercase mb-1">预设命令</div>
          <select
            value={irTxPresetIndex}
            onChange={(e) => onPresetSelect(Number(e.target.value))}
            className="w-full bg-[--bg-card] border border-[--border] rounded px-2 py-1.5 text-xs text-[--fg-primary]"
          >
            {IR_PRESETS.map((preset, i) => (
              <option key={i} value={i}>
                {preset.name} {preset.note ? `(${preset.note})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Address and Command */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-[--fg-muted] uppercase mb-1">地址 (ADDR)</div>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                max="255"
                value={irTxAddr}
                onChange={(e) => {
                  setIrTxAddr(e.target.value);
                  setIrTxAddrHex(parseInt(e.target.value || '0', 10).toString(16).toUpperCase().padStart(2, '0'));
                  setIrTxPresetIndex(IR_PRESETS.length - 1);
                }}
                className="flex-1 bg-[--bg-card] border border-[--border] rounded px-2 py-1 text-xs font-mono text-[--fg-primary]"
                placeholder="0"
              />
              <input
                type="text"
                value={irTxAddrHex}
                onChange={(e) => {
                  const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(-2);
                  setIrTxAddrHex(hex.toUpperCase());
                  setIrTxAddr(parseInt(hex || '0', 16).toString());
                  setIrTxPresetIndex(IR_PRESETS.length - 1);
                }}
                className="w-12 bg-[--bg-card] border border-[--border] rounded px-1 py-1 text-xs font-mono text-[--fg-primary]"
                placeholder="00"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[--fg-muted] uppercase mb-1">命令 (CMD)</div>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                max="255"
                value={irTxData}
                onChange={(e) => {
                  setIrTxData(e.target.value);
                  setIrTxCmdHex(parseInt(e.target.value || '0', 10).toString(16).toUpperCase().padStart(2, '0'));
                  setIrTxPresetIndex(IR_PRESETS.length - 1);
                }}
                className="flex-1 bg-[--bg-card] border border-[--border] rounded px-2 py-1 text-xs font-mono text-[--fg-primary]"
                placeholder="0"
              />
              <input
                type="text"
                value={irTxCmdHex}
                onChange={(e) => {
                  const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(-2);
                  setIrTxCmdHex(hex.toUpperCase());
                  setIrTxData(parseInt(hex || '0', 16).toString());
                  setIrTxPresetIndex(IR_PRESETS.length - 1);
                }}
                className="w-12 bg-[--bg-card] border border-[--border] rounded px-1 py-1 text-xs font-mono text-[--fg-primary]"
                placeholder="00"
              />
            </div>
          </div>
        </div>

        {/* Send Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSend}
            disabled={!connected}
            className="px-4 py-1.5 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-colors font-medium"
          >
            发送红外
          </button>
          <button
            onClick={onRefresh}
            disabled={!connected}
            className="px-3 py-1.5 rounded text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 transition-colors"
          >
            刷新状态
          </button>
        </div>
      </div>
    </Card>
  );
}
