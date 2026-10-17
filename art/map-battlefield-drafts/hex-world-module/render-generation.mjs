import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {worldEdge} from './hex-geometry.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const layout=JSON.parse(fs.readFileSync(path.join(root,'generation/layout.example.json'),'utf8'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="820" viewBox="0 0 1240 820"><defs><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0 L10,5 L0,10Z" fill="#65d0ed"/></marker></defs><style>text{font-family:Arial,sans-serif;fill:#e4ebe7}.title{font-size:27px;font-weight:bold}.heading{font-size:21px;font-weight:bold}.body{font-size:16px}.small{font-size:14px;fill:#afc4c6}.address{font-size:20px;font-weight:bold}</style><rect width="1240" height="820" fill="#142126"/>`];
const text=(x,y,s,cls='body',anchor='start')=>parts.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${escape(s)}</text>`);
const rect=(x,y,w,h,c)=>parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${c}"/>`);
text(28,42,'Procedural hex matching · every touching edge must agree','title');
text(28,72,`Seed: ${layout.request.seed} · 9 hexes · fixed bridge at B2 · debug labels shown`);
rect(24,96,582,536,'#203238');rect(626,96,590,536,'#203238');
text(44,132,'Generated road and river layout','heading');
const R=69,A=Math.sqrt(3)*R/2;
for(const cell of layout.cells){
 const {column,row}=cell.position,x=131+Math.sqrt(3)*R*(column+.5*(row%2)),y=238+1.5*R*row;
 const vertices=Array.from({length:6},(_,i)=>[x+R*Math.cos(-Math.PI/2+i*Math.PI/3),y+R*Math.sin(-Math.PI/2+i*Math.PI/3)]);
 parts.push(`<polygon points="${vertices.map(v=>v.join(',')).join(' ')}" fill="${cell.templateId==='bridge'?'#5e624c':cell.tags.includes('river')?'#2c5665':'#355344'}" stroke="#86aa94" stroke-width="2"/>`);
 for(let w=0;w<6;w++){
  const edge=worldEdge(cell,w);if(!edge.connector)continue;
  const ex=x+A*Math.cos(w*Math.PI/3),ey=y+A*Math.sin(w*Math.PI/3),river=edge.connector.kind==='river';
  let start=[x,y],end=[ex,ey];if(river&&edge.connector.flow==='in')[start,end]=[end,start];
  parts.push(`<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${river?'#65c9e4':'#e7bd75'}" stroke-width="${river?7:6}" ${river?'marker-end="url(#arrow)"':''}/>`);
 }
 text(x,y-24,cell.id,'address','middle');text(x,y+25,cell.templateId.replaceAll('-',' '),'small','middle');
}
text(44,565,'Gold: dirt road       Blue arrows: river flow');
text(44,595,'Terrain and route properties match across each shared side.','small');
text(648,132,'Allowed and rejected connections','heading');
const cases=[['dirt + road','dirt + road','MATCH','#589a76'],['dirt + road','stone + road','REJECT','#c98377'],['dirt + road','dirt only','REJECT','#c98377'],['water + river OUT','water + river IN','MATCH','#589a76'],['water + river IN','water + river IN','REJECT','#c98377'],['grass','forest','TRANSITION TILE','#d4ad65']];
for(let i=0;i<cases.length;i++){
 const [a,b,label,color]=cases[i],y=178+i*63;
 text(650,y,a);text(871,y,'↔');text(905,y,b);
 parts.push(`<text x="650" y="${y+23}" class="small" style="fill:${color}">${label}</text>`);
}
text(648,581,'A transition changes properties inside the tile.','small');
text(648,605,'The touching side signatures still match exactly.','small');
rect(24,652,1192,144,'#203238');text(44,688,'Generation contract','heading');
text(44,722,'Filter compatible rotations → choose by seeded weights → check all neighbors → backtrack when needed.');
text(44,754,'Closed map boundaries · bounded search · no rule relaxation · same seed + same sources = same layout');
text(44,779,'Offline prototype data; game rendering, object placement and gameplay wiring are separate integration steps.','small');
parts.push('</svg>');const svg=parts.join('\n');fs.writeFileSync(path.join(root,'generation/preview.svg'),svg+'\n');
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','image/svg+xml');res.end(svg)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1240,height:820},deviceScaleFactor:1});await page.goto('http://127.0.0.1:'+server.address().port);await page.screenshot({path:path.join(root,'generation/preview.png')});console.log('Rendered compatible-edge layout and matching examples.');}finally{await browser?.close();await new Promise(r=>server.close(r));}
