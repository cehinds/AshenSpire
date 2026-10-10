import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {compileCardComponents,generateCardComponents} from './card-components.mjs';
import {contentBundle} from '../src/content/index.js';
import {cardLayoutDocumentWithChanges} from '../src/model/cardLayoutDocument.js';
const source='src/content/card-layout.json';
const hash=text=>createHash('sha256').update(text).digest('hex');
export function readCardLayout(root){const text=readFileSync(join(root,source),'utf8');return {revision:hash(text),document:JSON.parse(text)};}
const compiledRevisions=new Map();
export function refreshCardLayout(root){const current=readCardLayout(root);if(compiledRevisions.get(root)!==current.revision){generateCardComponents(root);compiledRevisions.set(root,current.revision);}return current;}
export function saveCardLayout(root,{revision,document:input}={}){
  const path=join(root,source),original=readFileSync(path,'utf8'),current=JSON.parse(original);
  if(revision!==hash(original))throw Error('The game JSON changed since this editor opened. Reload before saving.');
  if(input?.version!==1||input.coordinateSpace?.width!==360||input.coordinateSpace?.height!==540)throw Error('Expected a version 1 layout in the 360 × 540 coordinate space.');
  if(!Array.isArray(input.order)||input.order.length!==9||new Set(input.order).size!==9||input.order.some(n=>!Number.isInteger(n)||n<1||n>9))throw Error('Layer order must contain layers 1–9 once each.');
  const allowed=new Set([...current.layers.map(l=>l.id),'card-trim','panel-trim','flag-trim','rank-bar','rank-text','heading-fill','footer-fill','footer-trim','action-icon','action-text','tag-0','tag-1','tag-2']);
  function rectangles(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>40)throw Error('Invalid component rectangles.');const result={};for(const [id,r] of Object.entries(value)){if(!allowed.has(id)||!r||['x','y','w','h'].some(k=>!Number.isFinite(r[k])||Math.abs(r[k])>4000)||r.w<=0||r.h<=0)throw Error('Invalid rectangle: '+id);result[id]={x:r.x,y:r.y,w:r.w,h:r.h};}return result;}
  const layout=rectangles(input.layouts?.shared),refs=rectangles(input.referenceRects);
  if(!layout.panel||!refs.panel)throw Error('The text box reference is required.');
  const next=cardLayoutDocumentWithChanges(current,{...input,layouts:{shared:layout},referenceRects:refs});
  compileCardComponents(next,contentBundle.cards,root);
  try{writeFileSync(path,JSON.stringify(next,null,2)+'\n');generateCardComponents(root);}catch(error){writeFileSync(path,original);generateCardComponents(root);throw error;}
  return {...readCardLayout(root),file:source};
}
