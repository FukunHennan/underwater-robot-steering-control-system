import { IRTransmitPanel } from './IRTransmitPanel';
import { IRTimingPanel, type IRParamsEdit, type IRMessage } from './IRTimingPanel';
import type { IRData } from '../../lib/modbus';

/**
 * Wrapper that lays out the IR tab cards (transmit + timing). Receive status
 * is folded into the transmit card for at-a-glance feedback after a send.
 *
 * Just composes the sub-panels with the shared connected state and forwards
 * everything else as-is.
 */
export function IRPanel(props: {
  ir: IRData | null;
  connected: boolean;
  // transmit panel props
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
  onSaveRx: () => void;
  // timing panel props
  irParamsEdit: IRParamsEdit;
  setIrParamsEdit: (updater: (prev: IRParamsEdit) => IRParamsEdit) => void;
  irMsg: IRMessage;
  onParamsRead: () => void;
  onParamsApply: () => void;
  onParamsReset: () => void;
}) {
  return (
    <>
      <IRTransmitPanel
        ir={props.ir}
        connected={props.connected}
        irTxAddr={props.irTxAddr}
        setIrTxAddr={props.setIrTxAddr}
        irTxAddrHex={props.irTxAddrHex}
        setIrTxAddrHex={props.setIrTxAddrHex}
        irTxData={props.irTxData}
        setIrTxData={props.setIrTxData}
        irTxCmdHex={props.irTxCmdHex}
        setIrTxCmdHex={props.setIrTxCmdHex}
        irTxPresetIndex={props.irTxPresetIndex}
        setIrTxPresetIndex={props.setIrTxPresetIndex}
        onPresetSelect={props.onPresetSelect}
        onSend={props.onSend}
        onRefresh={props.onRefresh}
        onSaveRx={props.onSaveRx}
      />
      <IRTimingPanel
        irParamsEdit={props.irParamsEdit}
        setIrParamsEdit={props.setIrParamsEdit}
        irMsg={props.irMsg}
        connected={props.connected}
        onRead={props.onParamsRead}
        onApply={props.onParamsApply}
        onReset={props.onParamsReset}
      />
    </>
  );
}
