function ms(value){const n=new Date(value).getTime();if(Number.isNaN(n))throw new TypeError('Invalid timestamp');return n;}
function vnDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}

export class HistoryBuffer {
  constructor(frames = []) { this.frames = []; for (const f of frames) this.add(f); }
  add(frame) {
    if (!frame?.timestamp) throw new TypeError('History frame requires timestamp');
    const clone = structuredClone(frame);
    const t = ms(clone.timestamp);
    const i = this.frames.findIndex(x => ms(x.timestamp) > t || (ms(x.timestamp) === t && String(x.source_id) > String(clone.source_id)));
    if (i < 0) this.frames.push(clone); else this.frames.splice(i, 0, clone);
    return clone;
  }
  getFrameAtOrBefore(timestamp) { const t=ms(timestamp); let out=null; for(const f of this.frames){if(ms(f.timestamp)<=t)out=f;else break;} return out?structuredClone(out):null; }
  getPreviousFrame(timestamp) { const t=ms(timestamp); for(let i=this.frames.length-1;i>=0;i--){if(ms(this.frames[i].timestamp)<t)return structuredClone(this.frames[i]);} return null; }
  getWindow(from,to){const a=ms(from),b=ms(to);return this.frames.filter(f=>{const t=ms(f.timestamp);return t>=a&&t<=b;}).map(x=>structuredClone(x));}
  getSessionFrames(sessionDate){return this.frames.filter(f=>vnDate(f.timestamp)===sessionDate).map(x=>structuredClone(x));}
  getNearestAtOrBefore(timestamp, targetSecondsAgo, toleranceSeconds) {
    const current=ms(timestamp), target=current-targetSecondsAgo*1000; let best=null,bestDiff=Infinity;
    for(const f of this.frames){const t=ms(f.timestamp); if(t>=current) continue; const diff=Math.abs(t-target); if(diff<bestDiff&&diff<=toleranceSeconds*1000){best=f;bestDiff=diff;}}
    return best?structuredClone(best):null;
  }
  firstTimestamp(){return this.frames[0]?.timestamp||null;}
  lastTimestamp(){return this.frames.at(-1)?.timestamp||null;}
  size(){return this.frames.length;}
}
