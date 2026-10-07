import { locationPresentation as data } from '../src/content/generated/locationPresentation.js';
import { presentationProblems } from '../src/model/locationPresentation.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const problems = presentationProblems();
if (problems.length) throw Error(problems.join('\n'));
const lines=['# Scene coverage','', '| Profile | Day | Night |','|---|---:|---:|'];
for (const profile of data.profiles) {
  const pool=data.sceneProfiles.filter(row=>row.profileId===profile.profileId);
  const count=time=>pool.filter(row=>data.scenes.find(s=>s.sceneId===row.sceneId).timeId===time).length;
  lines.push(`| ${profile.profileId} | ${count('day')} | ${count('night')} |`);
}
lines.push('', 'Zero means no exact artwork variant: selection retains the setting/biome and reports a time fallback. Music bindings are currently empty.');
const out=process.argv.indexOf('--out');
if(out>=0)writeFileSync(resolve(process.argv[out+1]),lines.join('\n')+'\n');else console.log(lines.join('\n'));
const csv=process.argv.indexOf('--csv-out');
if(csv>=0){const dir=resolve(process.argv[csv+1]);mkdirSync(dir,{recursive:true});for(const [table,rows] of Object.entries(data)){if(!rows.length)continue;const keys=Object.keys(rows[0]);const cell=v=>'"'+String(v).replaceAll('"','""')+'"';writeFileSync(resolve(dir,table+'.csv'),[keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\n')+'\n')}}
