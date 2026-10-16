// Serve the unchanged trusted wrapper and loader from the repository's origin/dev.
import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';import {execFileSync} from 'node:child_process';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),repo=process.env.ASHENSPIRE_REPO||'/workspace/AshenSpire',build=process.env.CARD_PREVIEW_BUILD||resolve(here,'../build.txt');
const source=execFileSync('git',['-C',repo,'show','origin/dev:tools/pages-site.mjs'],{encoding:'utf8',maxBuffer:2e6});
const constant=name=>source.match(new RegExp('export const '+name+' = (.+);'))[1];
const csp=Function('return '+constant('PREVIEW_CSP'))();
const sandbox=Function('return '+constant('PREVIEW_SANDBOX'))();
const start=source.indexOf('export const PREVIEW_SCRIPT = ')+ 'export const PREVIEW_SCRIPT = '.length;
const end=source.indexOf('\n`;\n',start)+2;
const script=Function('PREVIEW_BUILD_FILE','return '+source.slice(start,end))('build.txt');
const funcStart=source.indexOf('export function previewWrapperHtml('),funcEnd=source.indexOf('\n}\n',funcStart)+2;
const func=source.slice(funcStart,funcEnd).replace('export ','');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrapper=Function('esc','PREVIEW_CSP','PREVIEW_SANDBOX','PREVIEW_SCRIPT_FILE',func+';return previewWrapperHtml("Feature/CardPreview");')(esc,csp,sandbox,'preview.js');
const before=execFileSync('git',['-C',repo,'show','ab18a73cd:docs/design/card-tag-design/published-card-preview/build.txt'],{maxBuffer:20e6});
createServer(async(req,res)=>{if(req.url.endsWith('preview.js')){res.setHeader('Content-Type','text/javascript');res.end(script);}else if(req.url.endsWith('build.txt')){res.setHeader('Content-Type','text/plain');res.end(req.url.startsWith('/before/')?before:await readFile(build));}else{res.setHeader('Content-Type','text/html');res.end(wrapper);}}).listen(8771,'127.0.0.1',()=>console.log('Exact trusted wrapper http://127.0.0.1:8771/after/'));
