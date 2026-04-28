import { Compass } from 'lucide-react';
import { Card } from '../common/Card';
import { Metric } from '../common/Metric';
import { cn, fmtFloat } from '../../lib/utils';
import type { MagnetometerData } from '../../lib/types';

/**
 * Magnetometer readout with derived total field magnitude and an
 * uncompensated compass heading (planar atan2). Heading is only meaningful
 * when the platform is roughly level — see the inline note for caveats.
 */
export function MagnetometerCard({
  mag,
  expanded,
}: {
  mag: MagnetometerData | null;
  expanded: boolean;
}) {
  const heading = mag
    ? (((Math.atan2(mag.magY, mag.magX) * 180) / Math.PI + 360) % 360).toFixed(1)
    : '--';
  const magnitude = mag ? fmtFloat(Math.hypot(mag.magX, mag.magY, mag.magZ)) : '--';

  return (
    <Card
      title="磁力计 (MS901M)"
      icon={<Compass className="w-4 h-4 text-purple-400" />}
      className={cn(expanded ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-4')}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Mag X" value={mag ? fmtFloat(mag.magX) : '--'} unit="uT" color="text-purple-400" />
        <Metric label="Mag Y" value={mag ? fmtFloat(mag.magY) : '--'} unit="uT" color="text-purple-400" />
        <Metric label="Mag Z" value={mag ? fmtFloat(mag.magZ) : '--'} unit="uT" color="text-purple-400" />
        <Metric label="温度" value={mag ? fmtFloat(mag.temperature) : '--'} unit="°C" />
        <Metric label="合成磁场 |B|" value={magnitude} unit="uT" color="text-fuchsia-400" />
        <Metric label="罗盘航向" value={heading} unit="°" color="text-amber-400" />
      </div>
      <div className="mt-3 pt-3 border-t border-[--border] text-[10px] text-[--fg-muted] leading-relaxed">
        航向角基于水平投影，未做倾角补偿，板子不水平时仅供参考；如需精准航向请与 IMU 倾角融合。
      </div>
    </Card>
  );
}
