// ======================== Register Address Map ========================

export const REG = {
  DEVICE_ID: 0x0000,
  FW_VERSION: 0x0001,
  RUN_MODE: 0x0002,
  FAULT_CODE: 0x0003,
  SYS_TICK_L: 0x0004,
  SYS_TICK_H: 0x0005,

  ROLL: 0x0010,
  PITCH: 0x0012,
  YAW: 0x0014,
  GYRO_X: 0x0016,
  GYRO_Y: 0x0018,
  GYRO_Z: 0x001a,

  SERVO1: 0x0020,
  SERVO2: 0x0021,
  SERVO3: 0x0022,
  SERVO4: 0x0023,
  SERVO5: 0x0024,
  SERVO6: 0x0025,
  SERVO7: 0x0026,
  SERVO8: 0x0027,
  LED1: 0x0028,
  LED2: 0x0029,

  TEMP1: 0x0030,
  TEMP2: 0x0031,
  TEMP3: 0x0032,
  TEMP4: 0x0033,
  VOLTAGE: 0x0034,
  ADC_RAW0: 0x0035,
  ADC_RAW1: 0x0036,
  ADC_RAW2: 0x0037,
  ADC_RAW3: 0x0038,
  ADC_RAW4: 0x0039,

  PWM_ARR_G1: 0x0040,
  PWM_PSC_G1: 0x0041,
  PWM_ARR_G2: 0x0042,
  PWM_PSC_G2: 0x0043,
  PWM_ARR_G3: 0x0044,
  PWM_PSC_G3: 0x0045,
  PWM_ARR_G4: 0x0046,
  PWM_PSC_G4: 0x0047,

  PRESSURE_H: 0x0048,
  PRESSURE_L: 0x0049,
  ALTITUDE_H: 0x004a,
  ALTITUDE_L: 0x004b,
  BARO_TEMP: 0x004c,

  MAG_X: 0x004e,
  MAG_Y: 0x0050,
  MAG_Z: 0x0052,
  MAG_TEMP: 0x0054,

  CAL_VOLT_GAIN: 0x0056,
  CAL_VOLT_OFF:  0x0058,
  CAL_ANALOG1_GAIN: 0x005a,
  CAL_ANALOG1_OFF:  0x005c,
  CAL_ANALOG2_GAIN: 0x005e,
  CAL_ANALOG2_OFF:  0x0060,
  CAL_ANALOG3_GAIN: 0x0062,
  CAL_ANALOG3_OFF:  0x0064,
  CAL_ANALOG4_GAIN: 0x0066,
  CAL_ANALOG4_OFF:  0x0068,
  CAL_CMD:       0x006a,
  CAL_STATUS:    0x006b,

  GPIO_MODE0: 0x006c,
  GPIO_MODE1: 0x006d,
  GPIO_MODE2: 0x006e,
  GPIO_MODE3: 0x006f,
  GPIO_OUT0:  0x0070,
  GPIO_OUT1:  0x0071,
  GPIO_OUT2:  0x0072,
  GPIO_OUT3:  0x0073,
  GPIO_IN0:   0x0074,
  GPIO_IN1:   0x0075,
  GPIO_IN2:   0x0076,
  GPIO_IN3:   0x0077,

  IR_TX_CMD:  0x0078,
  IR_TX_DATA: 0x0079,
  IR_RX_STATUS: 0x007a,
  IR_RX_DATA: 0x007b,
  IR_LEAD_LOW_LO:  0x007c,
  IR_LEAD_LOW_HI:  0x007d,
  IR_LEAD_HIGH_LO: 0x007e,
  IR_LEAD_HIGH_HI: 0x007f,

  KALMAN_Q_ROLL:    0x0086,
  KALMAN_R_ROLL:    0x0088,
  KALMAN_Q_PITCH:   0x008a,
  KALMAN_R_PITCH:   0x008c,
  KALMAN_Q_YAW:     0x008e,
  KALMAN_R_YAW:     0x0090,
  KALMAN_Q_GYRO_X:  0x0092,
  KALMAN_R_GYRO_X:  0x0094,
  KALMAN_Q_GYRO_Y:  0x0096,
  KALMAN_R_GYRO_Y:  0x0098,
  KALMAN_Q_GYRO_Z:  0x009a,
  KALMAN_R_GYRO_Z:  0x009c,
  KALMAN_CMD: 0x009e,

  SERVO_SAVE_CMD: 0x009f,   /* Write CAL_CMD_SAVE (0x5A5A) → deferred Flash save */
  DBG_EN:         0x00e8,   /* Write 1=enable, 0=disable debug output on device */

  SERVO_COMP_BASE: 0x00a0,
  SERVO_COMP_ENABLE: 0x00e0,

  SERVO_COMP_BASE_ANGLE: 0x00a0,
  SERVO_COMP_ENABLE_0: 0x00e0,
} as const;

export const CAL_CH = {
  VOLTAGE: 0,
  ANALOG1: 1,
  ANALOG2: 2,
  ANALOG3: 3,
  ANALOG4: 4,
} as const;

export const CAL_CH_NAMES = ['VOLTAGE', 'ANALOG1', 'ANALOG2', 'ANALOG3', 'ANALOG4'] as const;

export const CAL_CMD_SAVE  = 0x5A5A;
export const CAL_CMD_RESET = 0xA5A5;

// ======================== CRC16 ========================

const CRC_TABLE = new Uint16Array(256).map((_, i) => {
  let crc = i;
  for (let j = 0; j < 8; j++) crc = crc & 1 ? 0xA001 ^ (crc >> 1) : crc >> 1;
  return crc;
});

export function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (const b of data) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8);
  return crc;
}

function appendCRC(frame: Uint8Array): Uint8Array {
  const crc = crc16(frame);
  const result = new Uint8Array(frame.length + 2);
  result.set(frame);
  result[frame.length] = crc & 0xFF;
  result[frame.length + 1] = (crc >> 8) & 0xFF;
  return result;
}

export function verifyCRC(response: Uint8Array): boolean {
  if (response.length < 2) return false;
  const receivedCRC = (response[response.length - 1] << 8) | response[response.length - 2];
  const computedCRC = crc16(response.subarray(0, response.length - 2));
  return receivedCRC === computedCRC;
}

// ======================== Frame builders ========================

function buildReadHolding(slaveId: number, startAddr: number, numRegs: number): Uint8Array {
  return appendCRC(new Uint8Array([slaveId, 0x03, startAddr >> 8, startAddr & 0xFF, numRegs >> 8, numRegs & 0xFF]));
}

function buildWriteSingle(slaveId: number, addr: number, value: number): Uint8Array {
  return appendCRC(new Uint8Array([slaveId, 0x06, addr >> 8, addr & 0xFF, value >> 8, value & 0xFF]));
}

function buildWriteMultiple(slaveId: number, startAddr: number, values: number[]): Uint8Array {
  const byteCount = values.length * 2;
  const frame = new Uint8Array(7 + byteCount);
  frame[0] = slaveId;
  frame[1] = 0x10;
  frame[2] = startAddr >> 8;
  frame[3] = startAddr & 0xFF;
  frame[4] = values.length >> 8;
  frame[5] = values.length & 0xFF;
  frame[6] = byteCount;
  for (let i = 0; i < values.length; i++) {
    frame[7 + i * 2] = values[i] >> 8;
    frame[8 + i * 2] = values[i] & 0xFF;
  }
  return appendCRC(frame);
}

// ======================== Response parser ========================

function parseReadResponse(response: Uint8Array): number[] {
  if (!verifyCRC(response)) throw new Error('响应CRC校验失败');
  if (response[1] & 0x80) throw new Error(`读取异常: 0x${response[2].toString(16)}`);
  const byteCount = response[2];
  if (response.length < 3 + byteCount + 2) throw new Error('响应长度不足');
  const values: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    values.push((response[3 + i] << 8) | response[4 + i]);
  }
  return values;
}

// ======================== Float conversion helpers ========================

export function floatToRegs(v: number): [number, number] {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, v, false);
  return [view.getUint16(0, false), view.getUint16(2, false)];
}

export function regsToFloat(hi: number, lo: number): number {
  const bytes = new Uint8Array(4);
  bytes[0] = (hi >> 8) & 0xFF; bytes[1] = hi & 0xFF;
  bytes[2] = (lo >> 8) & 0xFF; bytes[3] = lo & 0xFF;
  return new DataView(bytes.buffer).getFloat32(0, false);
}

export function regsToInt32(hi: number, lo: number): number { return (hi << 16) | lo; }
export function regToInt16(v: number): number { return v > 0x7FFF ? v - 0x10000 : v; }

// ======================== Types ========================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type QueuePriority = 'normal' | 'high';

export interface ModbusLog {
  time: string;
  dir: 'TX' | 'RX' | 'ERR';
  data: string;
}

export interface ReconnectInfo {
  attempt: number;
  max: number;
  reason: 'physical' | 'comm-error';
}

export interface GPIOData {
  modes: number[];
  outputs: number[];
  inputs: number[];
}

export interface IRData {
  txCmd: number;
  txData: number;
  rxStatus: number;
  rxData: number;
}

type QueueItemType = 'read' | 'write';

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  priority: QueuePriority;
  type: QueueItemType;
}

// ======================== ModbusClient ========================

export class ModbusClient {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private slaveId = 1;
  private _state: ConnectionState = 'disconnected';
  private _logs: ModbusLog[] = [];
  private _onStateChange?: (state: ConnectionState) => void;
  private _onLog?: (logs: ModbusLog[]) => void;
  private _onReconnect?: (info: ReconnectInfo | null) => void;

  /* ---- Reconnect state ---- */
  private lastBaudRate = 9600;
  private lastPortInfo: SerialPortInfo | null = null;
  private consecutiveFailures = 0;
  private reconnecting = false;
  private userDisconnected = false;
  private disconnectHandler: (() => void) | null = null;
  private serialConnectHandler: ((ev: Event) => void) | null = null;

  private static readonly FAIL_THRESHOLD = 3;
  private static readonly MAX_ATTEMPTS = 10;
  private static readonly BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000];

  /* ---- Transaction queue ---- */
  private _queue: QueueItem[] = [];
  private _busy = false;
  private _pendingWrites = 0;
  private _holdCount = 0;

  /**
   * True when write transactions are in-flight or the client has been
   * manually held (via {@link hold} / {@link release}).
   *
   * Polling code calls this before starting a cycle AND between every
   * read-group inside a cycle so writes are never delayed by reads.
   */
  hasPendingWrites(): boolean {
    return this._pendingWrites > 0 || this._holdCount > 0;
  }

  /** Prevent polling from sending any Modbus requests. */
  hold(): void {
    this._holdCount++;
  }

  /** Re-allow polling. MUST be paired with a previous {@link hold} call. */
  release(): void {
    if (this._holdCount > 0) this._holdCount--;
  }

  private enqueue<T>(fn: () => Promise<T>, priority: QueuePriority = 'normal', type: QueueItemType = 'read'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (priority === 'high') {
        this._queue.unshift({ fn, resolve, reject, priority, type });
      } else {
        this._queue.push({ fn, resolve, reject, priority, type });
      }
      this._processQueue();
    });
  }

  private async _processQueue() {
    if (this._busy || this._queue.length === 0) return;

    // If the front item is a read and writes are pending, look for a write
    // deeper in the queue. Writes (especially Flash saves) must execute ASAP;
    // reads sent while the slave is busy will time out and trigger reconnect.
    if (this._queue[0].type === 'read' && this.hasPendingWrites()) {
      const wi = this._queue.findIndex(i => i.type === 'write');
      if (wi > 0) {
        const [write] = this._queue.splice(wi, 1);
        this._queue.unshift(write);
      } else {
        return;  // no writes to run, wait for the next enqueue event
      }
    }

    this._busy = true;
    const item = this._queue.shift()!;
    try {
      const result = await item.fn();
      this.noteCommResult(true);
      item.resolve(result);
    } catch (e) {
      this.noteCommResult(false);
      item.reject(e);
    }
    await new Promise(r => setTimeout(r, 15));
    this._busy = false;
    this._processQueue();
  }

  get state() { return this._state; }
  get logs() { return this._logs; }

  onStateChange(cb: (s: ConnectionState) => void) { this._onStateChange = cb; }
  onLog(cb: (logs: ModbusLog[]) => void) { this._onLog = cb; }
  onReconnect(cb: (info: ReconnectInfo | null) => void) { this._onReconnect = cb; }

  clearLog() {
    this._logs = [];
    this._onLog?.(this._logs);
  }

  private setState(s: ConnectionState) {
    this._state = s;
    this._onStateChange?.(s);
  }

  private addLog(dir: 'TX' | 'RX' | 'ERR', data: string) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this._logs = [...this._logs.slice(-999), { time, dir, data }];
    this._onLog?.(this._logs);
  }

  private toHex(buf: Uint8Array): string {
    return Array.from(buf).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  }

  async connect(baudRate = 9600) {
    if (!('serial' in navigator)) {
      throw new Error('浏览器不支持 Web Serial API，请使用 Chrome/Edge');
    }
    try {
      this.userDisconnected = false;
      this.setState('connecting');
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      this.writer = this.port.writable!.getWriter();
      this.reader = this.port.readable!.getReader();
      this.lastBaudRate = baudRate;
      this.lastPortInfo = this.port.getInfo();
      this.consecutiveFailures = 0;
      this.attachDisconnectListener();
      this.attachSerialConnectListener();
      this.setState('connected');
      this.addLog('TX', `已连接 (${baudRate} baud, 8N1)`);
    } catch (e: any) {
      this.setState('error');
      this.addLog('ERR', e.message || '连接失败');
      throw e;
    }
  }

  async disconnect() {
    this.userDisconnected = true;
    this.reconnecting = false;
    this.detachSerialConnectListener();
    this.detachDisconnectListener();
    await this.softClose();
    this.port = null;
    this.lastPortInfo = null;
    this.consecutiveFailures = 0;
    this._onReconnect?.(null);
    this.setState('disconnected');
    this.addLog('TX', '已断开');
  }

  private async softClose() {
    try { this.reader?.releaseLock(); } catch { }
    try { this.writer?.releaseLock(); } catch { }
    this.reader = null;
    this.writer = null;
    try { await this.port?.close(); } catch { }
  }

  private flushQueue(reason: string) {
    const pending = this._queue.splice(0);
    for (const item of pending) {
      item.reject(new Error(reason));
    }
  }

  private attachDisconnectListener() {
    if (!this.port || this.disconnectHandler) return;
    this.disconnectHandler = () => {
      this.addLog('ERR', '设备物理断开');
      this.setState('connecting');
      this.flushQueue('设备已断开');
      this.tryReconnect('physical');
    };
    (this.port as unknown as EventTarget).addEventListener('disconnect', this.disconnectHandler);
  }

  private detachDisconnectListener() {
    if (this.port && this.disconnectHandler) {
      (this.port as unknown as EventTarget).removeEventListener('disconnect', this.disconnectHandler);
    }
    this.disconnectHandler = null;
  }

  private attachSerialConnectListener() {
    if (this.serialConnectHandler) return;
    this.serialConnectHandler = (ev: Event) => {
      if (!this.reconnecting) return;
      const p = (ev as unknown as { port: SerialPort }).port;
      if (!p || !this.lastPortInfo) return;
      const info = p.getInfo();
      if (info.usbVendorId === this.lastPortInfo.usbVendorId &&
          info.usbProductId === this.lastPortInfo.usbProductId) {
        this.addLog('RX', '检测到设备重新插入');
      }
    };
    navigator.serial.addEventListener('connect', this.serialConnectHandler);
  }

  private detachSerialConnectListener() {
    if (this.serialConnectHandler) {
      navigator.serial.removeEventListener('connect', this.serialConnectHandler);
    }
    this.serialConnectHandler = null;
  }

  private async tryReconnect(reason: 'physical' | 'comm-error') {
    if (this.reconnecting || this.userDisconnected) return;
    this.reconnecting = true;
    this.setState('connecting');

    const MAX = ModbusClient.MAX_ATTEMPTS;
    for (let i = 0; i < MAX; i++) {
      if (this.userDisconnected) break;
      const attempt = i + 1;
      this._onReconnect?.({ attempt, max: MAX, reason });
      this.addLog('TX', `重连尝试 ${attempt}/${MAX} (${reason})`);
      await this.softClose();
      await new Promise(r => setTimeout(r, 300));
      if (await this.attemptOpen()) {
        this.reconnecting = false;
        this.consecutiveFailures = 0;
        this._onReconnect?.(null);
        this.setState('connected');
        this.addLog('RX', `重连成功 (第 ${attempt} 次)`);
        return;
      }
      if (i < MAX - 1) {
        await new Promise(r => setTimeout(r, ModbusClient.BACKOFF_MS[i]));
      }
    }
    this.reconnecting = false;
    this._onReconnect?.(null);
    this.port = null;
    this.setState('disconnected');
    this.addLog('ERR', `重连 ${MAX} 次失败，请手动重新连接`);
  }

  private async attemptOpen(): Promise<boolean> {
    const baud = this.lastBaudRate;
    const opts: SerialOptions = { baudRate: baud, dataBits: 8 as const, stopBits: 1 as const, parity: 'none' };
    if (this.port) {
      try {
        await this.port.open(opts);
        this.writer = this.port.writable!.getWriter();
        this.reader = this.port.readable!.getReader();
        this.attachDisconnectListener();
        return true;
      } catch { }
    }
    try {
      const ports = await navigator.serial.getPorts();
      let target: SerialPort | undefined;
      if (this.lastPortInfo) {
        const { usbVendorId, usbProductId } = this.lastPortInfo;
        target = ports.find(p => {
          const info = p.getInfo();
          return info.usbVendorId === usbVendorId && info.usbProductId === usbProductId;
        });
      }
      if (!target && ports.length === 1) target = ports[0];
      if (!target) return false;
      await target.open(opts);
      this.port = target;
      this.writer = target.writable!.getWriter();
      this.reader = target.readable!.getReader();
      this.attachDisconnectListener();
      return true;
    } catch {
      return false;
    }
  }

  private noteCommResult(ok: boolean) {
    if (ok) { this.consecutiveFailures = 0; return; }
    if (this.reconnecting || this.userDisconnected) return;
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= ModbusClient.FAIL_THRESHOLD) {
      this.addLog('ERR', `连续 ${this.consecutiveFailures} 次通讯失败，启动自动重连`);
      this.flushQueue('通讯失败，正在重连');
      this.tryReconnect('comm-error');
    }
  }

  private async transact(frame: Uint8Array, expectedLen: number, timeoutMs = 500): Promise<Uint8Array> {
    if (!this.writer || !this.reader) throw new Error('未连接');
    this.addLog('TX', this.toHex(frame));
    await this.writer.write(frame);
    const buffer = new Uint8Array(256);
    let pos = 0;
    const deadline = Date.now() + timeoutMs;
    while (pos < expectedLen && Date.now() < deadline) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<null>(res => { timer = setTimeout(() => res(null), remaining); });
      const read = this.reader.read().then(r => { clearTimeout(timer); return r; });
      const result = await Promise.race([read, timeout]);
      if (result === null) break;
      if (result.value) {
        const chunk = result.value;
        const copyLen = Math.min(chunk.length, 256 - pos);
        buffer.set(chunk.subarray(0, copyLen), pos);
        pos += copyLen;
      }
      if (result.done) break;
    }
    if (pos === 0) throw new Error('通信超时 - 无响应');
    const response = buffer.slice(0, pos);
    this.addLog('RX', this.toHex(response));
    return response;
  }

  async readHoldingRegisters(startAddr: number, numRegs: number, priority: QueuePriority = 'normal'): Promise<number[]> {
    return this.enqueue(async () => {
      const frame = buildReadHolding(this.slaveId, startAddr, numRegs);
      const expectedLen = 5 + numRegs * 2;
      const response = await this.transact(frame, expectedLen);
      return parseReadResponse(response);
    }, priority);
  }

  async writeSingleRegister(addr: number, value: number, priority: QueuePriority = 'normal'): Promise<void> {
    this._pendingWrites++;
    try {
      return await this.enqueue(async () => {
        const frame = buildWriteSingle(this.slaveId, addr, value);
        const response = await this.transact(frame, 8);
        if (!verifyCRC(response)) throw new Error('写入响应CRC校验失败');
        if (response[1] & 0x80) throw new Error(`写入异常: 0x${response[2].toString(16)}`);
      }, priority, 'write');
    } finally {
      this._pendingWrites--;
    }
  }

  async writeMultipleRegisters(startAddr: number, values: number[], priority: QueuePriority = 'normal'): Promise<void> {
    this._pendingWrites++;
    try {
      return await this.enqueue(async () => {
        const frame = buildWriteMultiple(this.slaveId, startAddr, values);
        const response = await this.transact(frame, 8);
        if (!verifyCRC(response)) throw new Error('写入响应CRC校验失败');
        if (response[1] & 0x80) throw new Error(`写入异常: 0x${response[2].toString(16)}`);
      }, priority, 'write');
    } finally {
      this._pendingWrites--;
    }
  }

  async writeFloatRegister(addr: number, value: number, priority: QueuePriority = 'normal'): Promise<void> {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, false);
    const bytes = new Uint8Array(buffer);
    const regHigh = (bytes[0] << 8) | bytes[1];
    const regLow = (bytes[2] << 8) | bytes[3];
    await this.writeMultipleRegisters(addr, [regHigh, regLow], priority);
  }

  async readSingleRegister(addr: number, priority: QueuePriority = 'normal'): Promise<number> {
    const regs = await this.readHoldingRegisters(addr, 1, priority);
    return regs[0];
  }

  async readFloatRegister(addr: number, priority: QueuePriority = 'normal'): Promise<number> {
    const regs = await this.readHoldingRegisters(addr, 2, priority);
    const bytes = new Uint8Array(4);
    bytes[0] = (regs[0] >> 8) & 0xFF; bytes[1] = regs[0] & 0xFF;
    bytes[2] = (regs[1] >> 8) & 0xFF; bytes[3] = regs[1] & 0xFF;
    const buffer = new ArrayBuffer(4);
    new Uint8Array(buffer).set(bytes);
    return new DataView(buffer).getFloat32(0, false);
  }

  async readSystem(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.DEVICE_ID, 6, priority);
    return { deviceId: regs[0], fwVersion: regs[1], runMode: regs[2], faultCode: regs[3], sysTick: (regs[5] << 16) | regs[4] };
  }

  async readAttitude(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.ROLL, 12, priority);
    return { roll: regsToFloat(regs[0], regs[1]), pitch: regsToFloat(regs[2], regs[3]), yaw: regsToFloat(regs[4], regs[5]), gyroX: regsToFloat(regs[6], regs[7]), gyroY: regsToFloat(regs[8], regs[9]), gyroZ: regsToFloat(regs[10], regs[11]) };
  }

  async readPWM(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.SERVO1, 10, priority);
    return { servos: regs.slice(0, 8), leds: regs.slice(8, 10) };
  }

  async readPWMFreq(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.PWM_ARR_G1, 8, priority);
    return { groups: [{ arr: regs[0], psc: regs[1] }, { arr: regs[2], psc: regs[3] }, { arr: regs[4], psc: regs[5] }, { arr: regs[6], psc: regs[7] }] };
  }

  async readADC(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.TEMP1, 10, priority);
    return { temps: [regToInt16(regs[0]) / 10, regToInt16(regs[1]) / 10, regToInt16(regs[2]) / 10, regToInt16(regs[3]) / 10], voltage: regToInt16(regs[4]) / 100, adcRaw: regs.slice(5, 10) };
  }

  async readBarometer(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.PRESSURE_H, 6, priority);
    return { pressure: regsToInt32(regs[0], regs[1]), altitude: regsToInt32(regs[2], regs[3]), temperature: regsToFloat(regs[4], regs[5]) };
  }

  async readMagnetometer(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.MAG_X, 8, priority);
    return { magX: regsToFloat(regs[0], regs[1]), magY: regsToFloat(regs[2], regs[3]), magZ: regsToFloat(regs[4], regs[5]), temperature: regsToFloat(regs[6], regs[7]) };
  }

  async readCalibration(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.CAL_VOLT_GAIN, 22, priority);
    const gains: number[] = [];
    const offsets: number[] = [];
    for (let ch = 0; ch < 5; ch++) {
      const base = ch * 4;
      gains.push(regsToFloat(regs[base], regs[base + 1]));
      offsets.push(regsToFloat(regs[base + 2], regs[base + 3]));
    }
    return { gains, offsets, status: regs[21] };
  }

  async readGPIO(priority?: QueuePriority): Promise<GPIOData> {
    const regs = await this.readHoldingRegisters(REG.GPIO_MODE0, 12, priority);
    return { modes: regs.slice(0, 4), outputs: regs.slice(4, 8), inputs: regs.slice(8, 12) };
  }

  async writeGPIOMode(ch: number, mode: number): Promise<void> {
    if (ch < 0 || ch > 3) throw new Error('GPIO 通道号越界');
    await this.writeSingleRegister(REG.GPIO_MODE0 + ch, mode ? 1 : 0, 'high');
  }

  async writeGPIOOutput(ch: number, value: number): Promise<void> {
    if (ch < 0 || ch > 3) throw new Error('GPIO 通道号越界');
    await this.writeSingleRegister(REG.GPIO_OUT0 + ch, value ? 1 : 0, 'high');
  }

  async readIR(priority?: QueuePriority): Promise<IRData> {
    const regs = await this.readHoldingRegisters(REG.IR_TX_CMD, 4, priority);
    return { txCmd: regs[0], txData: regs[1], rxStatus: regs[2], rxData: regs[3] };
  }

  async writeIRTx(addr: number, cmd: number): Promise<void> {
    await this.writeSingleRegister(REG.IR_TX_DATA, cmd & 0xFFFF, 'high');
    await this.writeSingleRegister(REG.IR_TX_CMD, addr & 0xFFFF, 'high');
  }

  async readIRParams(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.IR_LEAD_LOW_LO, 8, priority);
    return { leadLowLo: regs[0], leadLowHi: regs[1], leadHighLo: regs[2], leadHighHi: regs[3], bit0Lo: regs[4], bit0Hi: regs[5], bit1Lo: regs[6], bit1Hi: regs[7] };
  }

  async writeIRParams(params: { leadLowLo: number; leadLowHi: number; leadHighLo: number; leadHighHi: number; bit0Lo: number; bit0Hi: number; bit1Lo: number; bit1Hi: number }): Promise<void> {
    await this.writeMultipleRegisters(REG.IR_LEAD_LOW_LO, [
      params.leadLowLo & 0xFFFF, params.leadLowHi & 0xFFFF,
      params.leadHighLo & 0xFFFF, params.leadHighHi & 0xFFFF,
      params.bit0Lo & 0xFFFF, params.bit0Hi & 0xFFFF,
      params.bit1Lo & 0xFFFF, params.bit1Hi & 0xFFFF,
    ], 'high');
  }

  async writeCalibGain(ch: number, gain: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4;
    const [hi, lo] = floatToRegs(gain);
    await this.writeMultipleRegisters(addr, [hi, lo], 'high');
  }

  async writeCalibOffset(ch: number, offset: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4 + 2;
    const [hi, lo] = floatToRegs(offset);
    await this.writeMultipleRegisters(addr, [hi, lo], 'high');
  }

  async writeCalibChannel(ch: number, gain: number, offset: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4;
    const [gh, gl] = floatToRegs(gain);
    const [oh, ol] = floatToRegs(offset);
    await this.writeMultipleRegisters(addr, [gh, gl, oh, ol], 'high');
  }

  async saveCalibToFlash(): Promise<void> {
    await this.writeSingleRegister(REG.CAL_CMD, CAL_CMD_SAVE, 'high');
  }

  async resetCalibToDefault(): Promise<void> {
    await this.writeSingleRegister(REG.CAL_CMD, CAL_CMD_RESET, 'high');
  }

  async readKalmanParams(priority?: QueuePriority) {
    const regs = await this.readHoldingRegisters(REG.KALMAN_Q_ROLL, 24, priority);
    return {
      qRoll: regsToFloat(regs[0], regs[1]), rRoll: regsToFloat(regs[2], regs[3]),
      qPitch: regsToFloat(regs[4], regs[5]), rPitch: regsToFloat(regs[6], regs[7]),
      qYaw: regsToFloat(regs[8], regs[9]), rYaw: regsToFloat(regs[10], regs[11]),
      qGyroX: regsToFloat(regs[12], regs[13]), rGyroX: regsToFloat(regs[14], regs[15]),
      qGyroY: regsToFloat(regs[16], regs[17]), rGyroY: regsToFloat(regs[18], regs[19]),
      qGyroZ: regsToFloat(regs[20], regs[21]), rGyroZ: regsToFloat(regs[22], regs[23]),
    };
  }

  async writeKalmanParam(addr: number, value: number): Promise<void> {
    const [hi, lo] = floatToRegs(value);
    await this.writeMultipleRegisters(addr, [hi, lo], 'high');
  }

  async writeKalmanParams(params: { qRoll: number; rRoll: number; qPitch: number; rPitch: number; qYaw: number; rYaw: number; qGyroX: number; rGyroX: number; qGyroY: number; rGyroY: number; qGyroZ: number; rGyroZ: number }): Promise<void> {
    const toRegs = (v: number) => { const [hi, lo] = floatToRegs(v); return [hi, lo]; };
    await this.writeMultipleRegisters(REG.KALMAN_Q_ROLL, [
      ...toRegs(params.qRoll), ...toRegs(params.rRoll),
      ...toRegs(params.qPitch), ...toRegs(params.rPitch),
      ...toRegs(params.qYaw), ...toRegs(params.rYaw),
      ...toRegs(params.qGyroX), ...toRegs(params.rGyroX),
      ...toRegs(params.qGyroY), ...toRegs(params.rGyroY),
      ...toRegs(params.qGyroZ), ...toRegs(params.rGyroZ),
    ], 'high');
  }

  async resetKalmanFilter(): Promise<void> {
    await this.writeSingleRegister(REG.KALMAN_CMD, 0x5A5A, 'high');
  }

  /** Read servo compensation coefficient for a specific servo channel */
  async readServoCompCoeff(servoIdx: number, priority?: QueuePriority) {
    const baseAddr = REG.SERVO_COMP_BASE + servoIdx * 8;
    const regs = await this.readHoldingRegisters(baseAddr, 8, priority);
    return {
      baseAngle: regsToFloat(regs[0], regs[1]),
      kRoll: regsToFloat(regs[2], regs[3]),
      kPitch: regsToFloat(regs[4], regs[5]),
      kYaw: regsToFloat(regs[6], regs[7]),
    };
  }

  /** Write servo compensation coefficient for a specific servo channel */
  async writeServoCompCoeff(servoIdx: number, coeff: { baseAngle: number; kRoll: number; kPitch: number; kYaw: number }): Promise<void> {
    const baseAddr = REG.SERVO_COMP_BASE + servoIdx * 8;
    const [bh, bl] = floatToRegs(coeff.baseAngle);
    const [rh, rl] = floatToRegs(coeff.kRoll);
    const [ph, pl] = floatToRegs(coeff.kPitch);
    const [yh, yl] = floatToRegs(coeff.kYaw);
    await this.writeMultipleRegisters(baseAddr, [bh, bl, rh, rl, ph, pl, yh, yl], 'high');
  }

  /** Read servo compensation enable flag */
  async readServoCompEnable(servoIdx: number, priority?: QueuePriority): Promise<boolean> {
    const val = await this.readSingleRegister(REG.SERVO_COMP_ENABLE + servoIdx, priority);
    return val !== 0;
  }

  /** Write servo compensation enable flag */
  async writeServoCompEnable(servoIdx: number, enabled: boolean): Promise<void> {
    await this.writeSingleRegister(REG.SERVO_COMP_ENABLE + servoIdx, enabled ? 1 : 0, 'high');
  }

  /** Read all servo compensation coefficients (8 servos) */
  async readAllServoComp(priority?: QueuePriority) {
    const channels: Array<{ baseAngle: number; kRoll: number; kPitch: number; kYaw: number }> = [];
    for (let i = 0; i < 8; i++) {
      channels.push(await this.readServoCompCoeff(i, priority));
    }
    return channels;
  }

  /** Read all servo compensation enable flags */
  async readAllServoCompEnable(priority?: QueuePriority): Promise<boolean[]> {
    const enables: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      enables.push(await this.readServoCompEnable(i, priority));
    }
    return enables;
  }

  /** Save all servo compensation parameters to Flash */
  async saveServoCompToFlash(): Promise<void> {
    await this.writeSingleRegister(REG.SERVO_SAVE_CMD, CAL_CMD_SAVE, 'high');
  }
}
