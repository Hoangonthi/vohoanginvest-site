export class TimeEngine {
  constructor({ start = 0, end = 120, tickMs = 1000, onTick = () => {}, onEnd = () => {} } = {}) {
    this.time = start;
    this.start = start;
    this.end = end;
    this.tickMs = tickMs;
    this.speed = 1;
    this.running = false;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.timer = null;
    this.temporarySpeedUntil = 0;
    this.temporarySpeed = null;
  }
  setSpeed(speed) {
    this.speed = Math.max(1, Number(speed) || 1);
    if (this.running) this._reschedule();
  }
  getEffectiveSpeed() {
    if (this.temporarySpeed && Date.now() < this.temporarySpeedUntil) return this.temporarySpeed;
    this.temporarySpeed = null;
    return this.speed;
  }
  slowTemporarily(speed = 1, durationMs = 2200) {
    this.temporarySpeed = Math.max(1, Number(speed) || 1);
    this.temporarySpeedUntil = Date.now() + Math.max(300, durationMs);
    if (this.running) this._reschedule();
  }
  play() {
    if (this.time >= this.end || this.running) return;
    // Game timelines that start at 0 should enter Day 1 immediately when Play is pressed.
    // This avoids a dead "Day 0" beat and makes the visible run Day 1 -> Day N continuously.
    if (this.time === 0 && this.end >= 1) this.step(1);
    if (this.time >= this.end) return;
    this.running = true;
    this._schedule();
  }
  pause() {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = null;
  }
  step(amount = 1) {
    const next = Math.min(this.end, this.time + Math.max(1, amount));
    while (this.time < next) {
      this.time += 1;
      this.onTick(this.time);
    }
    if (this.time >= this.end) {
      this.pause();
      this.onEnd(this.time);
    }
  }
  jumpTo(target) {
    if (target > this.time) this.step(target - this.time);
  }
  _delay() {
    return Math.max(70, Math.round(this.tickMs / this.getEffectiveSpeed()));
  }
  _reschedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.running) this._schedule();
  }
  _schedule() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.step(1);
      if (this.running) this._schedule();
    }, this._delay());
  }
}
