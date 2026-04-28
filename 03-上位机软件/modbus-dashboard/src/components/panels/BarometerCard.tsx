import { CloudRain } from 'lucide-react';
import { Card } from '../common/Card';
import type { BarometerData } from '../../lib/types';

/**
 * Pressure / altitude / temperature readout from the MS901M barometer.
 * Uses raw value blocks instead of `<Metric>` to also surface the raw
 * Pa / cm values in a smaller side text.
 */
export function BarometerCard({ baro }: { baro: BarometerData | null }) {
  return (
    <Card
      title="气压计 (MS901M)"
      icon={<CloudRain className="w-4 h-4 text-cyan-400" />}
      className="col-span-12 lg:col-span-3"
    >
      <div className="space-y-3">
        <div className="bg-[--bg-input] rounded px-3 py-2">
          <div className="text-[10px] text-[--fg-muted] uppercase">气压</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-mono font-bold text-cyan-400">
              {baro ? (baro.pressure / 100).toFixed(2) : '--'}
            </span>
            <span className="text-xs text-[--fg-muted]">hPa</span>
          </div>
          {baro && (
            <div className="text-[10px] text-[--fg-muted] font-mono mt-0.5">{baro.pressure} Pa</div>
          )}
        </div>
        <div className="bg-[--bg-input] rounded px-3 py-2">
          <div className="text-[10px] text-[--fg-muted] uppercase">海拔高度</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-mono font-bold text-emerald-400">
              {baro ? (baro.altitude / 100).toFixed(2) : '--'}
            </span>
            <span className="text-xs text-[--fg-muted]">m</span>
          </div>
          {baro && (
            <div className="text-[10px] text-[--fg-muted] font-mono mt-0.5">{baro.altitude} cm</div>
          )}
        </div>
        <div className="bg-[--bg-input] rounded px-3 py-2">
          <div className="text-[10px] text-[--fg-muted] uppercase">温度</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-mono font-bold text-amber-400">
              {baro ? baro.temperature.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-[--fg-muted]">°C</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
