import { IRTransmitPanel } from './IRTransmitPanel';
import { IRReceivePanel } from './IRReceivePanel';
import { IRTimingPanel, type IRParamsEdit, type IRMessage } from './IRTimingPanel';
import type { IRData } from '../../lib/modbus';

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
      <IRReceivePanel
        ir={props.ir}
        connected={props.connected}
        onRefresh={props.onRefresh}
        onSaveRx={props.onSaveRx}
      />
      <IRTransmitPanel
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
