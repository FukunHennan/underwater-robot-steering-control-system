/**
 * Modbus RTU protocol over Web Serial API
 * Matches the STM32F407 register map exactly.
 */

// ======================== CRC16 ========================

const CRC_TABLE = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  CRC_TABLE[i] = crc;
}

function crc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return crc;
}

function appendCRC(frame: Uint8Array): Uint8Array {
  const crc = crc16(frame);
  const result = new Uint8Array(frame.length + 2);
  result.set(frame);
  result[frame.length] = crc & 0xff;
  result[frame.length + 1] = (crc >> 8) & 0xff;
  return result;
}

function verifyCRC(frame: Uint8Array): boolean {
  if (frame.length < 4) return false;
  const payload = frame.slice(0, frame.length - 2);
  const received = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
  return crc16(payload) === received;
}

// ======================== Frame builders ========================

/** FC03: Read Holding Registers */
function buildReadHolding(slaveId: number, startAddr: number, numRegs: number): Uint8Array {
  const frame = new Uint8Array([
    slaveId,
    0x03,
    (startAddr >> 8) & 0xff, startAddr & 0xff,
    (numRegs >> 8) & 0xff, numRegs & 0xff,
  ]);
  return appendCRC(frame);
}

/** FC06: Write Single Register */
function buildWriteSingle(slaveId: number, addr: number, value: number): Uint8Array {
  const frame = new Uint8Array([
    slaveId,
    0x06,
    (addr >> 8) & 0xff, addr & 0xff,
    (value >> 8) & 0xff, value & 0xff,
  ]);
  return appendCRC(frame);
}

/** FC16: Write Multiple Registers */
function buildWriteMultiple(slaveId: number, startAddr: number, values: number[]): Uint8Array {
  const numRegs = values.length;
  const byteCount = numRegs * 2;
  const frame = new Uint8Array(7 + byteCount);
  frame[0] = slaveId;
  frame[1] = 0x10;
  frame[2] = (startAddr >> 8) & 0xff;
  frame[3] = startAddr & 0xff;
  frame[4] = (numRegs >> 8) & 0xff;
  frame[5] = numRegs & 0xff;
  frame[6] = byteCount;
  for (let i = 0; i < numRegs; i++) {
    frame[7 + i * 2] = (values[i] >> 8) & 0xff;
    frame[8 + i * 2] = values[i] & 0xff;
  }
  return appendCRC(frame);
}

// ======================== Response parsers ========================

function parseReadResponse(response: Uint8Array): number[] {
  // [slaveId, 0x03, byteCount, data..., crcL, crcH]
  if (!verifyCRC(response)) throw new Error('CRC校验失败');
  if (response[1] & 0x80) throw new Error(`Modbus异常: 0x${response[2].toString(16)}`);
  const byteCount = response[2];
  const regs: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    regs.push((response[3 + i] << 8) | response[4 + i]);
  }
  return regs;
}

// ======================== Float conversion ========================

/** Convert 2 Modbus registers (Big-Endian word order) to IEEE 754 float */
export function regsToInt32(hi: number, lo: number): number {
  const val = (hi << 16) | lo;
  return val > 0x7FFFFFFF ? val - 0x100000000 : val;
}

export function regsToFloat(high: number, low: number): number {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, high, false); // Big-Endian
  view.setUint16(2, low, false);
  return view.getFloat32(0, false);
}

/** Convert int16 stored in uint16 register */
export function regToInt16(value: number): number {
  return value > 32767 ? value - 65536 : value;
}

/** Split IEEE 754 float into 2 Big-Endian word-ordered registers [high, low] */
export function floatToRegs(v: number): [number, number] {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, v, false); // Big-Endian
  return [view.getUint16(0, false), view.getUint16(2, false)];
}

// ======================== Register map ========================

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

  /* ADC Calibration (0x0050 - 0x0065) — float = 2 regs each, big-endian word order */
  CAL_VOLT_GAIN: 0x0050,
  CAL_VOLT_OFF:  0x0052,
  CAL_AN1_GAIN:  0x0054,
  CAL_AN1_OFF:   0x0056,
  CAL_AN2_GAIN:  0x0058,
  CAL_AN2_OFF:   0x005a,
  CAL_AN3_GAIN:  0x005c,
  CAL_AN3_OFF:   0x005e,
  CAL_AN4_GAIN:  0x0060,
  CAL_AN4_OFF:   0x0062,
  CAL_CMD:       0x0064,
  CAL_STATUS:    0x0065,

  GPIO_MODE0:    0x0066,
  GPIO_MODE1:    0x0067,
  GPIO_MODE2:    0x0068,
  GPIO_MODE3:    0x0069,
  GPIO_OUT0:     0x006a,
  GPIO_OUT1:     0x006b,
  GPIO_OUT2:     0x006c,
  GPIO_OUT3:     0x006d,
  GPIO_IN0:      0x006e,
  GPIO_IN1:      0x006f,
  GPIO_IN2:      0x0070,
  GPIO_IN3:      0x0071,

  IR_TX_CMD:     0x0072,
  IR_TX_DATA:    0x0073,
  IR_RX_STATUS:  0x0074,
  IR_RX_DATA:    0x0075,

  /* IR timing parameters (0x0076-0x007D) */
  IR_LEAD_LOW_LO:  0x0076,
  IR_LEAD_LOW_HI:  0x0077,
  IR_LEAD_HIGH_LO: 0x0078,
  IR_LEAD_HIGH_HI: 0x0079,
  IR_BIT0_LO:      0x007A,
  IR_BIT0_HI:      0x007B,
  IR_BIT1_LO:      0x007C,
  IR_BIT1_HI:      0x007D,
} as const;

/** Calibration channel indices (match firmware CALIB_CH_*) */
export const CAL_CH = {
  VOLTAGE: 0,
  ANALOG1: 1,
  ANALOG2: 2,
  ANALOG3: 3,
  ANALOG4: 4,
} as const;

export const CAL_CH_NAMES = ['VOLTAGE', 'ANALOG1', 'ANALOG2', 'ANALOG3', 'ANALOG4'] as const;

/** Calibration command register values (match firmware CALIB_CMD_*) */
export const CAL_CMD_SAVE  = 0x5A5A;
export const CAL_CMD_RESET = 0xA5A5;

// ======================== Serial + Modbus class ========================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

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

  /* Failure threshold and backoff schedule */
  private static readonly FAIL_THRESHOLD = 3;
  private static readonly MAX_ATTEMPTS = 10;
  private static readonly BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000];

  /* ---- Transaction queue (Modbus is half-duplex, one at a time) ---- */
  private _queue: Array<{ fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private _busy = false;

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  private async _processQueue() {
    if (this._busy || this._queue.length === 0) return;
    this._busy = true;
    const { fn, resolve, reject } = this._queue.shift()!;
    try {
      const result = await fn();
      this.noteCommResult(true);
      resolve(result);
    } catch (e) {
      this.noteCommResult(false);
      reject(e);
    }
    /* Inter-frame gap: 15ms (> 3.5 char times at 9600 baud ≈ 4ms) */
    await new Promise(r => setTimeout(r, 15));
    this._busy = false;
    this._processQueue();
  }

  get state() { return this._state; }
  get logs() { return this._logs; }

  onStateChange(cb: (s: ConnectionState) => void) { this._onStateChange = cb; }
  onLog(cb: (logs: ModbusLog[]) => void) { this._onLog = cb; }
  /** Reconnect progress callback; emits null when reconnect finishes/aborts */
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
    this.userDisconnected = true;   /* 用户主动断开，禁止自动重连 */
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

  /** Release locks and close port, tolerant to errors */
  private async softClose() {
    try { this.reader?.releaseLock(); } catch { /* ignore */ }
    try { this.writer?.releaseLock(); } catch { /* ignore */ }
    this.reader = null;
    this.writer = null;
    try { await this.port?.close(); } catch { /* ignore */ }
  }

  /** Clear all pending requests in the queue (reject them with reason) */
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
    /* SerialPort inherits EventTarget */
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
        /* The backoff loop picks this up via getPorts() on its next iteration;
           no need to bypass the loop — keeps state machine simple. */
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

  /** Auto-reconnect driver. Idempotent: duplicate calls are no-op. */
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

      /* Release and re-open */
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

      /* Wait before next attempt with backoff */
      if (i < MAX - 1) {
        await new Promise(r => setTimeout(r, ModbusClient.BACKOFF_MS[i]));
      }
    }

    /* All attempts exhausted */
    this.reconnecting = false;
    this._onReconnect?.(null);
    this.port = null;
    this.setState('disconnected');
    this.addLog('ERR', `重连 ${MAX} 次失败，请手动重新连接`);
  }

  /** Try to open either the existing port (soft) or a re-enumerated port (hard). */
  private async attemptOpen(): Promise<boolean> {
    const baud = this.lastBaudRate;
    const opts: SerialOptions = { baudRate: baud, dataBits: 8 as const, stopBits: 1 as const, parity: 'none' };

    /* Soft reconnect: existing port object still valid (MCU reset but USB-UART alive) */
    if (this.port) {
      try {
        await this.port.open(opts);
        this.writer = this.port.writable!.getWriter();
        this.reader = this.port.readable!.getReader();
        this.attachDisconnectListener();
        return true;
      } catch {
        /* Fall through to hard reconnect */
      }
    }

    /* Hard reconnect: device was re-enumerated, find it via authorized ports */
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

  /** Called by transact() on success/failure to drive auto-reconnect */
  private noteCommResult(ok: boolean) {
    if (ok) {
      this.consecutiveFailures = 0;
      return;
    }
    if (this.reconnecting || this.userDisconnected) return;
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= ModbusClient.FAIL_THRESHOLD) {
      this.addLog('ERR', `连续 ${this.consecutiveFailures} 次通讯失败，启动自动重连`);
      this.flushQueue('通讯失败，正在重连');
      this.tryReconnect('comm-error');
    }
  }

  /** Send frame and collect response with timeout (must be called inside queue) */
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

      /* Use a timeout promise; if it wins the race, we stop reading */
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<null>(res => { timer = setTimeout(() => res(null), remaining); });
      const read = this.reader.read().then(r => { clearTimeout(timer); return r; });

      const result = await Promise.race([read, timeout]);

      if (result === null) break; // timeout
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

  /** Read holding registers (FC03) — queued */
  async readHoldingRegisters(startAddr: number, numRegs: number): Promise<number[]> {
    return this.enqueue(async () => {
      const frame = buildReadHolding(this.slaveId, startAddr, numRegs);
      const expectedLen = 5 + numRegs * 2;
      const response = await this.transact(frame, expectedLen);
      return parseReadResponse(response);
    });
  }

  /** Write single register (FC06) — queued */
  async writeSingleRegister(addr: number, value: number): Promise<void> {
    return this.enqueue(async () => {
      const frame = buildWriteSingle(this.slaveId, addr, value);
      const response = await this.transact(frame, 8);
      if (!verifyCRC(response)) throw new Error('写入响应CRC校验失败');
      if (response[1] & 0x80) throw new Error(`写入异常: 0x${response[2].toString(16)}`);
    });
  }

  /** Write multiple registers (FC16) — queued */
  async writeMultipleRegisters(startAddr: number, values: number[]): Promise<void> {
    return this.enqueue(async () => {
      const frame = buildWriteMultiple(this.slaveId, startAddr, values);
      const response = await this.transact(frame, 8);
      if (!verifyCRC(response)) throw new Error('写入响应CRC校验失败');
      if (response[1] & 0x80) throw new Error(`写入异常: 0x${response[2].toString(16)}`);
    });
  }

  /** Read all system registers (0x0000-0x0005) */
  async readSystem() {
    const regs = await this.readHoldingRegisters(REG.DEVICE_ID, 6);
    return {
      deviceId: regs[0],
      fwVersion: regs[1],
      runMode: regs[2],
      faultCode: regs[3],
      sysTick: (regs[5] << 16) | regs[4],
    };
  }

  /** Read all attitude float registers (0x0010-0x001B) */
  async readAttitude() {
    const regs = await this.readHoldingRegisters(REG.ROLL, 12);
    return {
      roll: regsToFloat(regs[0], regs[1]),
      pitch: regsToFloat(regs[2], regs[3]),
      yaw: regsToFloat(regs[4], regs[5]),
      gyroX: regsToFloat(regs[6], regs[7]),
      gyroY: regsToFloat(regs[8], regs[9]),
      gyroZ: regsToFloat(regs[10], regs[11]),
    };
  }

  /** Read all PWM registers (0x0020-0x0029) */
  async readPWM() {
    const regs = await this.readHoldingRegisters(REG.SERVO1, 10);
    return {
      servos: regs.slice(0, 8),
      leds: regs.slice(8, 10),
    };
  }

  /** Read PWM frequency registers (0x0040-0x0047) */
  async readPWMFreq() {
    const regs = await this.readHoldingRegisters(REG.PWM_ARR_G1, 8);
    return {
      groups: [
        { arr: regs[0], psc: regs[1] },
        { arr: regs[2], psc: regs[3] },
        { arr: regs[4], psc: regs[5] },
        { arr: regs[6], psc: regs[7] },
      ],
    };
  }

  /** Read all ADC registers (0x0030-0x0039) */
  async readADC() {
    const regs = await this.readHoldingRegisters(REG.TEMP1, 10);
    return {
      temps: [
        regToInt16(regs[0]) / 10,
        regToInt16(regs[1]) / 10,
        regToInt16(regs[2]) / 10,
        regToInt16(regs[3]) / 10,
      ],
      voltage: regToInt16(regs[4]) / 100,
      adcRaw: regs.slice(5, 10),
    };
  }

  /** Read barometer registers (0x0048-0x004D) */
  async readBarometer() {
    const regs = await this.readHoldingRegisters(REG.PRESSURE_H, 6);
    return {
      pressure: regsToInt32(regs[0], regs[1]),
      altitude: regsToInt32(regs[2], regs[3]),
      temperature: regsToFloat(regs[4], regs[5]),
    };
  }

  /**
   * Read all calibration parameters (0x0050-0x0065)
   * @returns { gains, offsets, status } — 5 channels in order: VOLTAGE, ANALOG1..4
   */
  async readCalibration() {
    /* 20 regs for gain/offset pairs + CMD(1) + STATUS(1) = 22 regs */
    const regs = await this.readHoldingRegisters(REG.CAL_VOLT_GAIN, 22);
    const gains: number[] = [];
    const offsets: number[] = [];
    for (let ch = 0; ch < 5; ch++) {
      const base = ch * 4;
      gains.push(regsToFloat(regs[base], regs[base + 1]));
      offsets.push(regsToFloat(regs[base + 2], regs[base + 3]));
    }
    return {
      gains,
      offsets,
      status: regs[21], // REG.CAL_STATUS is the 22nd register (index 21)
    };
  }

  /** Read GPIO block (0x0066-0x0071) */
  async readGPIO(): Promise<GPIOData> {
    const regs = await this.readHoldingRegisters(REG.GPIO_MODE0, 12);
    return {
      modes: regs.slice(0, 4),
      outputs: regs.slice(4, 8),
      inputs: regs.slice(8, 12),
    };
  }

  /** Set GPIO mode for one channel: 0=input, 1=output */
  async writeGPIOMode(ch: number, mode: number): Promise<void> {
    if (ch < 0 || ch > 3) throw new Error('GPIO 通道号越界');
    await this.writeSingleRegister(REG.GPIO_MODE0 + ch, mode ? 1 : 0);
  }

  /** Set GPIO output level for one channel: 0=low, 1=high */
  async writeGPIOOutput(ch: number, value: number): Promise<void> {
    if (ch < 0 || ch > 3) throw new Error('GPIO 通道号越界');
    await this.writeSingleRegister(REG.GPIO_OUT0 + ch, value ? 1 : 0);
  }

  /** Read IR placeholder block (0x0072-0x0075) */
  async readIR(): Promise<IRData> {
    const regs = await this.readHoldingRegisters(REG.IR_TX_CMD, 4);
    return {
      txCmd: regs[0],
      txData: regs[1],
      rxStatus: regs[2],
      rxData: regs[3],
    };
  }

  /** Write IR placeholder command/data */
  async writeIRTx(cmd: number, data: number): Promise<void> {
    await this.writeMultipleRegisters(REG.IR_TX_CMD, [cmd & 0xFFFF, data & 0xFFFF]);
  }

  /** Read IR timing parameters (0x0076-0x007D) */
  async readIRParams(): Promise<{
    leadLowLo: number; leadLowHi: number;
    leadHighLo: number; leadHighHi: number;
    bit0Lo: number; bit0Hi: number;
    bit1Lo: number; bit1Hi: number;
  }> {
    const regs = await this.readHoldingRegisters(REG.IR_LEAD_LOW_LO, 8);
    return {
      leadLowLo: regs[0], leadLowHi: regs[1],
      leadHighLo: regs[2], leadHighHi: regs[3],
      bit0Lo: regs[4], bit0Hi: regs[5],
      bit1Lo: regs[6], bit1Hi: regs[7],
    };
  }

  /** Write all IR timing parameters */
  async writeIRParams(params: {
    leadLowLo: number; leadLowHi: number;
    leadHighLo: number; leadHighHi: number;
    bit0Lo: number; bit0Hi: number;
    bit1Lo: number; bit1Hi: number;
  }): Promise<void> {
    await this.writeMultipleRegisters(REG.IR_LEAD_LOW_LO, [
      params.leadLowLo & 0xFFFF, params.leadLowHi & 0xFFFF,
      params.leadHighLo & 0xFFFF, params.leadHighHi & 0xFFFF,
      params.bit0Lo & 0xFFFF, params.bit0Hi & 0xFFFF,
      params.bit1Lo & 0xFFFF, params.bit1Hi & 0xFFFF,
    ]);
  }

  /** Write gain for a single calibration channel (0..4) */
  async writeCalibGain(ch: number, gain: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4;
    const [hi, lo] = floatToRegs(gain);
    await this.writeMultipleRegisters(addr, [hi, lo]);
  }

  /** Write offset for a single calibration channel (0..4) */
  async writeCalibOffset(ch: number, offset: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4 + 2;
    const [hi, lo] = floatToRegs(offset);
    await this.writeMultipleRegisters(addr, [hi, lo]);
  }

  /** Write both gain and offset for a channel in one FC16 transaction */
  async writeCalibChannel(ch: number, gain: number, offset: number): Promise<void> {
    if (ch < 0 || ch > 4) throw new Error('校准通道号越界');
    const addr = REG.CAL_VOLT_GAIN + ch * 4;
    const [gh, gl] = floatToRegs(gain);
    const [oh, ol] = floatToRegs(offset);
    await this.writeMultipleRegisters(addr, [gh, gl, oh, ol]);
  }

  /** Save current calibration RAM values to Flash (persistent) */
  async saveCalibToFlash(): Promise<void> {
    await this.writeSingleRegister(REG.CAL_CMD, CAL_CMD_SAVE);
  }

  /** Reset all calibration channels to default (gain=1.0, offset=0.0). RAM only, not saved to Flash. */
  async resetCalibToDefault(): Promise<void> {
    await this.writeSingleRegister(REG.CAL_CMD, CAL_CMD_RESET);
  }
}
