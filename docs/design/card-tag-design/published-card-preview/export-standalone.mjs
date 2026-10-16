import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(process.env.ASHENSPIRE_REPO||'/workspace/AshenSpire');
const out=resolve(process.env.CARD_PREVIEW_OUTPUT||resolve(here,'../published-card-preview'));
const preview=process.env.CARD_PREVIEW_URL||'http://127.0.0.1:8767/';
const {launchBrowser}=await import(pathToFileURL(resolve(repo,'tools/browser.mjs')));
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json');
const {chromium}=require('playwright');
const launched=await launchBrowser({prefix:'cardexport-',browser:process.env.CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const browser=await chromium.connectOverCDP(launched.wsUrl);
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
try{
 const page=await browser.newPage({viewport:{width:1100,height:1150}});
 await page.goto(preview);await page.waitForFunction(()=>window.previewReady);
 await page.getByRole('button',{name:'Show all 70 combat proposals',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#all .card').length===70&&[...document.querySelectorAll('#all [data-card-binding="rules"]')].every(x=>x.dataset.fittedFont));
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 const snapshot=await page.evaluate(()=>{
  const clone=document.documentElement.cloneNode(true);
  clone.querySelectorAll('script,link,base').forEach(x=>x.remove());
  const imgs=[...clone.querySelectorAll('img')];
  const urls=[...new Set(imgs.map(x=>x.getAttribute('src')))];
  imgs.forEach(x=>{x.dataset.asset=String(urls.indexOf(x.getAttribute('src')));x.removeAttribute('src');});
  clone.querySelectorAll('.card').forEach(c=>{
   const name=c.getAttribute('aria-label').replace(/^Inspect /,'');c.dataset.proposalName=name;
   c.querySelectorAll('.ic-text').forEach(x=>{if(x.style.fontSize.endsWith('px'))x.style.fontSize=(parseFloat(x.style.fontSize)/280*100)+'cqw';});
  });
  clone.querySelector('#all').style.display='none';
  const backgrounds=[...new Set([...document.querySelectorAll('*')].map(x=>getComputedStyle(x).backgroundImage).flatMap(x=>[...x.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])))];
  return {html:'<!doctype html>\n'+clone.outerHTML,urls,backgrounds,stylePaths:[...document.querySelectorAll('link[rel=stylesheet]')].map(x=>x.href)};
 });
 let proposalPath=process.env.CARD_PREVIEW_PROPOSALS||resolve(here,'proposals.json');
 if(!process.env.CARD_PREVIEW_PROPOSALS){try{await readFile(proposalPath);}catch{proposalPath=resolve(here,'../ingame-look-preview/proposals.json');}}
 const proposals=JSON.parse(await readFile(proposalPath,'utf8')).cards.filter(c=>['combatCard','statusCard'].includes(c.entityKind));
 const assets={};const assetPaths={};
 async function inline(url){const absolute=new URL(url,preview).href;if(assets[absolute])return assets[absolute];const r=await fetch(absolute);if(!r.ok)throw Error('Asset '+r.status+' '+absolute);const bytes=Buffer.from(await r.arrayBuffer());const value='data:'+r.headers.get('content-type').split(';')[0]+';base64,'+bytes.toString('base64');assets[absolute]=value;assetPaths[absolute]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};return value;}
 const imgAssets=await Promise.all(snapshot.urls.map(inline));
 let css='';
 for(const path of snapshot.stylePaths){let source=await(await fetch(path)).text();if(/@import\b/.test(source))throw Error('Unresolved CSS import '+path);const matches=[...source.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];for(const match of matches){if(match[2].startsWith('data:'))continue;const absolute=new URL(match[2],path).href;const keep=/\.(?:woff2?|ttf|otf)(?:[?#]|$)/i.test(absolute)||snapshot.backgrounds.includes(absolute);source=source.replace(match[0],keep?'url("'+await inline(absolute)+'")':'none');}css+='\n/* '+new URL(path).pathname+' */\n'+source;}
 const modalData=Object.fromEntries(proposals.map(c=>[c.name,{rules:c.inspection.fullRules}]));
 const runtime=`(()=>{const assets=${json(imgAssets)},data=${json(modalData)};const modal=document.querySelector('.inspection'),close=document.querySelector('.close');let previous=null;function hydrate(root){root.querySelectorAll('img[data-asset]').forEach(i=>i.src=assets[Number(i.dataset.asset)]);}hydrate(document);function inspect(card){previous=card;const name=card.dataset.proposalName;const copy=card.cloneNode(true);copy.removeAttribute('tabindex');copy.removeAttribute('role');document.querySelector('.inspect-card').replaceChildren(copy);const info=document.querySelector('.inspect-copy');info.replaceChildren();const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.textContent='Proposed effect · Full inspection';const title=document.createElement('h2');title.textContent=name;const rules=document.createElement('p');rules.textContent=data[name].rules;const note=document.createElement('p');note.style.cssText='font:13px/1.6 Arial;color:#aa9a80';note.textContent='Costs, rank, school and stance: unassigned. Reused current Simple illustration; visual reference only.';info.append(eyebrow,title,rules,note);modal.classList.add('open');close.focus();}function hide(){modal.classList.remove('open');previous?.focus();}document.querySelectorAll('.hero .card,#all .card').forEach(c=>{c.addEventListener('click',()=>inspect(c));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(c);}});});close.onclick=hide;document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(e.key==='Tab'&&modal.classList.contains('open')){e.preventDefault();close.focus();}});document.querySelector('.more').onclick=()=>{const a=document.querySelector('#all');const open=a.style.display!=='grid';a.style.display=open?'grid':'none';document.querySelector('.more').textContent=open?'Hide all 70 combat proposals':'Show all 70 combat proposals';};window.previewReady=false;Promise.all([...document.images].map(i=>i.decode())).then(()=>window.previewReady=true);})();`;
 let html=snapshot.html.replace('<style>','<style>'+css.replaceAll('</style','<\\/style')+'</style><style>');
 html=html.replace('</body>','<script>'+runtime+'</script></body>');
 if(/(?:src|href)=["']\/(?:src|assets|styles)\//.test(html))throw Error('Source dependency left');
 await mkdir(out,{recursive:true});await writeFile(resolve(out,'build.txt'),html);await writeFile(resolve(out,'standalone.html'),html);
 const manifest={createdAt:new Date().toISOString(),gameSource:'f7a24e0e39dd7823c15f89afd6023782526655d0',generator:'ingame-card-preview/export-standalone.mjs',renderedFrom:preview,standaloneSha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),featured:6,expanded:70,uniqueImages:snapshot.urls.length,assets:assetPaths,notes:'Production DOM/styles/Simple artwork; visual proposals only. No runtime source imports, fetches, external styles or external assets.'};
 await writeFile(resolve(out,'provenance.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({out,bytes:manifest.bytes,sha256:manifest.standaloneSha256,images:manifest.uniqueImages}));
}finally{await browser.close();await launched.close();}
