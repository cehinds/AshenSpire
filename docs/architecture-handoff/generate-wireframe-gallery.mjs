import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(root,'wireframe.md'),'utf8');
const catalog=[...JSON.parse(fs.readFileSync(path.join(root,'component-wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'tooltip-wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'card-wireframe-catalog.json')))];
const headings=[...source.matchAll(/^#{2,3} Wireframe (W\w+): (.+)$/gm)];
const data=catalog.map(entry=>{
 const index=headings.findIndex(h=>h[1]===entry.id);if(index<0)throw Error('Missing '+entry.id);
 const section=source.slice(headings[index].index,headings[index+1]?.index??source.length);
 const modes=[...section.matchAll(/\*\*(Wide|Compact|Vertical \/ Mobile)\*\*/g)];
 const views=modes.map((m,i)=>{const part=section.slice(m.index,modes[i+1]?.index??section.indexOf('**Language-agnostic pseudocode**'));const ascii=part.match(/```text\s*\n([\s\S]*?)```/)?.[1].trimEnd();const rows=part.split(/\r?\n/).filter(l=>l.startsWith('|')).map(l=>l.split('|').slice(1,-1).map(x=>x.trim().replaceAll('`',''))).filter(r=>!r[0].startsWith('---'));return {mode:['wide','compact','portrait'][i],ascii,rows};});
 if(views.length!==3||views.some(v=>!v.ascii||v.rows.length<2))throw Error('Incomplete '+entry.id);
 return {...entry,description:section.slice(section.indexOf('\n')+1,modes[0].index).trim(),views,pseudo:section.match(/\*\*Language-agnostic pseudocode\*\*\s*```text\s*\n([\s\S]*?)```/)?.[1]||''};
});
const template=fs.readFileSync(path.join(root,'wireframe-gallery-template.html'),'utf8');
fs.writeFileSync(path.join(root,'wireframe-gallery.html'),template.replace('/*DATA*/',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log(`Built ${data.length} wireframes / ${data.reduce((n,d)=>n+d.views.length,0)} views, with positioning tables and pseudocode.`);
