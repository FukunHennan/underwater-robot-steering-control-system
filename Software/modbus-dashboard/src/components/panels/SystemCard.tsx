import { Cpu } from 'lucide-react';
import { Card } from '../common/Card';
import { Metric } from '../common/Metric';
import { cn } from '../../lib/utils';
import { modeLabels } from '../../lib/presets';
import type { SystemData } from '../../lib/types';

/**
 * Top-level firmware identity + run state read from the system register block.
 * Sized differently when used as the only system view vs. on the home grid.
 */
export function SystemCard({ system, expanded }: { system: SystemData | null; expanded: boolean }) {
  return (
    <Card
      title="系统状态"
      icon={<Cpu className="w-4 h-4 text-[--accent]" />}
      className={cn(expanded ? 'col-span-12 lg:col-span-6' : 'col-span-12 lg:col-span-3')}
    >
      <div className="grid grid-cols-2 gap-4">
        <Metric
          label="设备ID"
          value={system ? `0x${system.deviceId.toString(16).toUpperCase().padStart(4, '0')}` : '--'}
        />
        <Metric
          label="固件版本"
          value={system ? `V${(system.fwVersion >> 8)}.${system.fwVersion & 0xff}` : '--'}
        />
        <Metric
          label="运行模式"
          value={system ? modeLabels[system.runMode] || `${system.runMode}` : '--'}
          color={
            system?.runMode === 2
              ? 'text-[--success]'
              : system?.runMode === 1
                ? 'text-[--warning]'
                : undefined
          }
        />
        <Metric
          label="故障码"
          value={system ? (system.faultCode === 0 ? '正常' : `0x${system.faultCode.toString(16)}`) : '--'}
          color={system?.faultCode ? 'text-[--danger]' : 'text-[--success]'}
        />
        <Metric
          label="运行时间"
          value={system ? `${(system.sysTick / 1000).toFixed(1)}` : '--'}
          unit="秒"
        />
      </div>
    </Card>
  );
}
