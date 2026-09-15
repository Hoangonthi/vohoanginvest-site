import { EventEmitter } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const REPLAY_SPEEDS = Object.freeze({ '1x': 1, '4x': 4, '12x': 12, '30x': 30, MAX: Infinity });

function normalizeSpeed(speed) {
  const key = String(speed || 'MAX');
  if (!(key in REPLAY_SPEEDS)) throw new RangeError(`unsupported replay speed: ${key}`);
  return key;
}

export class ReplayRunner extends EventEmitter {
  constructor(frames, options = {}) {
    super();
    if (!Array.isArray(frames)) throw new TypeError('frames must be an array');
    this.frames = frames.map((f) => structuredClone(f));
    this.speed = normalizeSpeed(options.speed || 'MAX');
    this.onFrame = options.onFrame || (async () => null);
    this.logPath = options.logPath || null;
    this.cursor = 0;
    this.state = 'idle';
    this.timer = null;
    this._completion = null;
    this._resolveCompletion = null;
    this.log = null;
  }

  _ensureRunLog() {
    if (this.log) return;
    const first = this.frames[0]?.timestamp || null;
    const last = this.frames.at(-1)?.timestamp || null;
    this.log = {
      run_id: randomUUID(),
      session_date: this.frames[0]?.metadata?.session_date || null,
      started_at: new Date().toISOString(),
      ended_at: null,
      speed: this.speed,
      frames_total: this.frames.length,
      frames_processed: 0,
      first_timestamp: first,
      last_timestamp: last,
      errors: [],
      outputs: []
    };
  }

  setSpeed(speed) {
    this.speed = normalizeSpeed(speed);
    if (this.log) this.log.speed = this.speed;
    this.emit('speed', this.speed);
  }

  start() {
    if (this.state === 'completed') throw new Error('runner already completed');
    if (this._completion) return this._completion;
    this._ensureRunLog();
    this._completion = new Promise((resolve) => { this._resolveCompletion = resolve; });
    this.state = 'running';
    this.emit('start', structuredClone(this.log));
    this._schedule(0);
    return this._completion;
  }

  pause() {
    if (this.state === 'completed' || this.state === 'paused') return false;
    this._ensureRunLog();
    if (!this._completion) this._completion = new Promise((resolve) => { this._resolveCompletion = resolve; });
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state = 'paused';
    this.emit('pause', { cursor: this.cursor });
    return true;
  }

  resume() {
    if (this.state !== 'paused') return false;
    this._ensureRunLog();
    if (!this._completion) this._completion = new Promise((resolve) => { this._resolveCompletion = resolve; });
    this.state = 'running';
    this.emit('resume', { cursor: this.cursor });
    this._schedule(0);
    return true;
  }

  async step() {
    if (this.state === 'running') this.pause();
    if (this.state === 'completed' || this.cursor >= this.frames.length) return null;
    this._ensureRunLog();
    if (!this._completion) this._completion = new Promise((resolve) => { this._resolveCompletion = resolve; });
    this.state = 'paused';
    const frame = await this._processCurrent();
    if (this.cursor >= this.frames.length) await this._finish();
    else this.state = 'paused';
    return frame;
  }

  jumpToTime(timestamp) {
    const target = new Date(timestamp).getTime();
    if (Number.isNaN(target)) throw new TypeError('jump timestamp must be valid');
    const index = this.frames.findIndex((f) => new Date(f.timestamp).getTime() >= target);
    this.cursor = index === -1 ? this.frames.length : index;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.emit('jump', { timestamp: new Date(target).toISOString(), cursor: this.cursor });
    if (this.state === 'running') this._schedule(0);
    return this.cursor;
  }

  _nextDelayMs() {
    if (this.speed === 'MAX' || this.cursor === 0) return 0;
    const factor = REPLAY_SPEEDS[this.speed];
    const prev = new Date(this.frames[this.cursor - 1].timestamp).getTime();
    const next = new Date(this.frames[this.cursor].timestamp).getTime();
    return Math.max(0, Math.round((next - prev) / factor));
  }

  _schedule(delay = null) {
    if (this.state !== 'running') return;
    if (this.cursor >= this.frames.length) { void this._finish(); return; }
    const ms = delay ?? this._nextDelayMs();
    this.timer = setTimeout(() => { this.timer = null; void this._tick(); }, ms);
  }

  async _tick() {
    if (this.state !== 'running') return;
    await this._processCurrent();
    if (this.cursor >= this.frames.length) await this._finish();
    else this._schedule();
  }

  async _processCurrent() {
    const frame = this.frames[this.cursor];
    if (!frame) return null;
    try {
      const output = await this.onFrame(structuredClone(frame), { run_id: this.log.run_id, cursor: this.cursor });
      this.log.outputs.push({ sequence: frame.metadata?.sequence ?? this.cursor + 1, timestamp: frame.timestamp, output: output ?? null });
      this.log.frames_processed += 1;
      this.emit('frame', structuredClone(frame), output ?? null);
    } catch (error) {
      const item = { sequence: frame.metadata?.sequence ?? this.cursor + 1, timestamp: frame.timestamp, message: String(error?.message || error) };
      this.log.errors.push(item);
      this.emit('frameError', item);
    }
    this.cursor += 1;
    return frame;
  }

  async _finish() {
    if (this.state === 'completed') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state = 'completed';
    this.log.ended_at = new Date().toISOString();
    if (this.logPath) {
      await mkdir(dirname(this.logPath), { recursive: true });
      await writeFile(this.logPath, `${JSON.stringify(this.log, null, 2)}\n`, 'utf8');
    }
    this.emit('complete', structuredClone(this.log));
    this._resolveCompletion?.(structuredClone(this.log));
  }
}
