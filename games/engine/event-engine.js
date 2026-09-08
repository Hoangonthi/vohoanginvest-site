export class EventEngine {
  constructor(events = []) {
    this.events = [...events].sort((a,b)=>a.time-b.time);
    this.seen = new Set();
  }
  getDue(time) {
    return this.events.filter(e => e.time === time && !this.seen.has(e.code));
  }
  markSeen(code) { this.seen.add(code); }
  nextMaterialAfter(time) {
    return this.events.find(e => e.time > time && ['MATERIAL','CRITICAL'].includes(e.materiality));
  }
}
