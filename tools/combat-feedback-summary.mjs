// Offline, read-only rendering of one immutable diagnostic artifact. No browser.
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const SOURCE = '499ecee90255201d99be6b18d7e5cf620332f1fe';
const HELPER = '7a550cdb1941f4d86dfd728daca02ea6edbe76fa';
const dir = resolve(process.argv[2] || 'diagnostic-artifact');
const allowed = /^(manifest\.json|play-[1-3]-(cpu|trace|measurements)\.json|build\.log|quick-inputs\.log|native\.log|diagnostic\.log)$/;
let total = 0;
for (const name of readdirSync(dir)) {
  const stat = lstatSync(join(dir, name));
  if (!allowed.test(name) || !stat.isFile() || stat.isSymbolicLink()) throw Error(`Unexpected entry: ${name}`);
  if (name.endsWith('.log') && stat.size > 512 * 1024) throw Error('Oversize log');
  total += stat.size;
}
if (total > 50 * 1024 * 1024) throw Error('Oversize artifact');
const read = name => JSON.parse(readFileSync(join(dir, name), 'utf8'));
const manifest = read('manifest.json');
if (manifest.sourceCommit !== SOURCE || manifest.helperCommit !== HELPER) throw Error('Manifest pin mismatch');
console.log('IMMUTABLE MANIFEST', JSON.stringify({ sourceCommit:manifest.sourceCommit, helperCommit:manifest.helperCommit, build:manifest.build, browserVersion:manifest.browser?.version, nativeVerdict:manifest.nativeVerdict?.outcome, captureMode:manifest.captureMode, seed:manifest.seed, requestedPlays:manifest.requestedPlays }));
const overlap = (a,b,c,d) => Math.max(0, Math.min(b,d)-Math.max(a,c));
const round = n => Math.round(n * 1000) / 1000;
for (let play = 1; play <= 3; play++) {
  const cpu = read(`play-${play}-cpu.json`), trace = read(`play-${play}-trace.json`), measurements = read(`play-${play}-measurements.json`);
  for (const record of [cpu,trace,measurements]) if (record.sourceCommit !== SOURCE) throw Error('Record pin mismatch');
  const d = measurements.sample?.diagnostic;
  if (![d?.up,d?.contact,d?.number].every(Number.isFinite)) throw Error(`Missing phase data: ${play}`);
  const nav = measurements.clock?.metrics?.NavigationStart;
  if (!Number.isFinite(nav)) throw Error('Missing clock mapping');
  const toPage = us => us / 1000 - nav * 1000;
  const nodes = new Map((cpu.profile?.nodes || []).map(n => [n.id,n]));
  const parents = new Map();
  for (const n of nodes.values()) for (const child of n.children || []) parents.set(child,n.id);
  const frame = id => { const f=nodes.get(id)?.callFrame; return f ? `${f.functionName || '(anonymous)'} ${f.url || ''}:${f.lineNumber+1}` : `node:${id}`; };
  const phases = [];
  for (const [name,start,end] of [['up→contact',d.up,d.contact],['contact→number',d.contact,d.number]]) {
    const self = new Map(), inclusive = new Map();
    let time = cpu.profile?.startTime || 0;
    for (let i=0;i<(cpu.profile?.samples?.length || 0);i++) {
      const next = time + (cpu.profile.timeDeltas?.[i] || 0);
      const ms = overlap(toPage(time),toPage(next),start,end);
      const id = cpu.profile.samples[i];
      if (ms) {
        self.set(frame(id),(self.get(frame(id))||0)+ms);
        const seen = new Set(); let cur=id;
        while (cur != null && !seen.has(cur)) { seen.add(cur); const key=frame(cur); inclusive.set(key,(inclusive.get(key)||0)+ms); cur=parents.get(cur); }
      }
      time=next;
    }
    const top = map => [...map].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([stack,ms])=>({stack,ms:round(ms)}));
    const events = (trace.traceEvents || []).filter(e => /Layout|Style|Paint|Decode|Image|GC|Task|Timer|AnimationFrame|BeginFrame|RunMicrotasks/i.test(e.name || '')).map(e => ({name:e.name,ph:e.ph,tid:e.tid,start:round(toPage(e.ts)),duration:round((e.dur||0)/1000),overlap:round(overlap(toPage(e.ts),toPage(e.ts+(e.dur||0)),start,end)),stack:e.args?.data?.stackTrace?.slice(0,3)})).filter(e=>e.overlap>0 || (e.start>=start && e.start<=end)).sort((a,b)=>b.overlap-a.overlap).slice(0,35);
    phases.push({name,start,end,duration:round(end-start),approximateSampleAttribution:true,self:top(self),inclusive:top(inclusive),events,
      longtasks:(d.longtasks||[]).filter(x=>overlap(x.start,x.start+x.duration,start,end)>0).slice(0,12),
      timers:(d.timers||[]).filter(x=>x.fired>=start&&x.fired<=end).map(x=>({...x,overdue:round(x.fired-x.scheduled-x.delay)})).sort((a,b)=>b.overdue-a.overdue).slice(0,15),
      frameGaps:(d.frames||[]).slice(1).map((t,i)=>({start:d.frames[i],end:t,gap:round(t-d.frames[i])})).filter(x=>overlap(x.start,x.end,start,end)>0).sort((a,b)=>b.gap-a.gap).slice(0,10),
      resources:(d.resources||[]).filter(x=>overlap(x.start,x.start+x.duration,start,end)>0).slice(0,15)});
  }
  const result={play,card:measurements.card,clock:measurements.clock,dropped:trace.dropped,errors:[...cpu.errors,...trace.errors,...measurements.errors],phaseTraceRecordCount:(d.trace||[]).length,phases};
  let output=JSON.stringify(result);
  if (Buffer.byteLength(output)>24*1024) { for (const p of phases) {p.events=p.events.slice(0,12);p.resources=p.resources.slice(0,5);p.self=p.self.slice(0,8);p.inclusive=p.inclusive.slice(0,8);} output=JSON.stringify(result); }
  if (Buffer.byteLength(output)>24*1024) throw Error('Summary exceeds 24KiB; refusing unbounded log');
  console.log('OBSERVATIONAL PHASE SUMMARY',output);
}
