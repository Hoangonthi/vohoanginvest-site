export class TimeEngine {
  constructor({ start = 0, end = 120, tickMs = 1000, onTick = () => {}, onEnd = () => {} } = {}) {
    this.time = start;
    this.end = end;
    this.tickMs = tickMs;
    this.speed = 1;
    this.running = false;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.timer = null;
  }
  setSpeed(speed) { this.speed = Math.max(1, Number(speed) || 1); }
  play() { if (this.running) return; this.running = true; this._schedule(); }
  pause() { this.running = false; clearTimeout(this.timer); }
  step(amount = 1) {
    const next = Math.min(this.end, this.time + amount);
    while (this.time < next) { this.time += 1; this.onTick(this.time); }
    if (this.time >= this.end) { this.pause(); this.onEnd(this.time); }
  }
  jumpTo(target) { if (target > this.time) this.step(target - this.time); }
  _schedule() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.step(this.speed);
      if (this.running) this._schedule();
    }, this.tickMs);
  }
}
