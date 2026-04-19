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
} as const;

// ======================== Serial + Modbus class ========================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ModbusLog {
  time: string;
  dir: 'TX' | 'RX' | 'ERR';
  data: string;
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
      resolve(result);
    } catch (e) {
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

  private setState(s: ConnectionState) {
    this._state = s;
    this._onStateChange?.(s);
  }

  private addLog(dir: 'TX' | 'RX' | 'ERR', data: string) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this._logs = [...this._logs.slice(-99), { time, dir, data }];
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
      this.setState('connecting');
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      this.writer = this.port.writable!.getWriter();
      this.reader = this.port.readable!.getReader();
      this.setState('connected');
      this.addLog('TX', `已连接 (${baudRate} baud, 8N1)`);
    } catch (e: any) {
      this.setState('error');
      this.addLog('ERR', e.message || '连接失败');
      throw e;
    }
  }

  async disconnect() {
    try {
      this.reader?.releaseLock();
      this.writer?.releaseLock();
      await this.port?.close();
    } catch { /* ignore */ }
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.setState('disconnected');
    this.addLog('TX', '已断开');
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
      voltage: regToInt16(regs[4]) / 10,
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
}
