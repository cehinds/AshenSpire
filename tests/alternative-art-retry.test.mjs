import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { alternativeSprite } from '../src/ui/alternativeArt.js';
import { enemySprite, playerSprite } from '../src/ui/assets.js';
import { setBuiltInSource } from '../src/ui/assetmap.js';
import { builtInArtArrived, currentArtUrl, resetHighResArt } from '../src/ui/highResArt.js';
import { restoreArtPlaceholders } from '../src/ui/artFallback.js';

// Exercise the production renderers and error handlers with an explicit load
// failure; the browser's blocked-index gate separately drives the real network.
class Element {
  constructor(tag) { this.tagName=tag.toUpperCase(); this.children=[]; this.parentNode=null; this.attrs={}; this.dataset={}; this.style={cssText:''}; this.listeners={}; this.className=''; }
  append(...nodes) { for(const node of nodes) { node.remove(); node.parentNode=this; this.children.push(node); } }
  remove() { if(this.parentNode) this.parentNode.children=this.parentNode.children.filter(node=>node!==this); this.parentNode=null; }
  setAttribute(key,value) { this.attrs[key]=String(value); if(key==='src')this.src=String(value); }
  getAttribute(key) { return key==='src' ? this.src ?? null : this.attrs[key] ?? null; }
  hasAttribute(key) { return key in this.attrs; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type,listener) { (this.listeners[type]??=[]).push(listener); }
  dispatch(type) { for(const listener of this.listeners[type]??[]) listener({type,target:this}); }
  querySelector(selector) { return this.querySelectorAll(selector)[0]??null; }
  querySelectorAll(selector) { const found=[]; const matches=node=>selector.split(',').some(part=>{const sel=part.trim();return sel==='img[src]' ? node.tagName==='IMG' && node.getAttribute('src')!==null : sel.startsWith('[') ? node.hasAttribute(sel.slice(1,-1)) : sel.startsWith('.') ? node.className.split(' ').includes(sel.slice(1)) : node.tagName===sel.toUpperCase();}); const visit=node=>{ for(const child of node.children){if(matches(child))found.push(child);visit(child);} };visit(this);return found; }
}
let root;
beforeEach(()=>{
  resetHighResArt(); setBuiltInSource(null); root=new Element('main');
  globalThis.document={createElement:tag=>new Element(tag),querySelectorAll:selector=>root.querySelectorAll(selector)};
  globalThis.Image=class extends Element { constructor(){super('img');} };
});
afterEach(()=>{delete globalThis.document;delete globalThis.Image;resetHighResArt();setBuiltInSource(null);});
const objectFor=id=>{const hash=catalog.hashes[id.split('/').at(-1)];return `objects/${hash.slice(0,2)}/${hash}.webp`;};

test('actual enemy and player figures become marked placeholders and Retry restores the same authored crop',()=>{
  const figures=[enemySprite({id:'graveWisp'}),playerSprite({},'reaver','default')];
  root.append(...figures);
  const originals=figures.map(figure=>({figure,image:figure.querySelector('img'),crop:figure.querySelector('.alternative-crop'),stage:figure.querySelector('.painted-stage'),geometry:figure.style.cssText}));
  for(const row of originals){
    row.image.dispatch('error');
    assert.equal(row.figure.querySelector('img'),null);
    assert.equal(row.figure.hasAttribute('data-art-placeholder'),true);
    assert.equal(row.figure.querySelector('span').getAttribute('role'),'img');
    assert.equal(row.figure.style.cssText,row.geometry);
  }
  const map=new Map(originals.map(row=>[row.image.src,objectFor(row.image.src)]));
  setBuiltInSource(map); builtInArtArrived(map);
  assert.equal(restoreArtPlaceholders(root),2);
  for(const row of originals){
    assert.equal(row.figure.parentNode,root,'the screen/figure is not replaced');
    assert.equal(row.figure.querySelector('img'),row.image,'the same image returns');
    assert.equal(row.figure.querySelector('.alternative-crop'),row.crop);
    assert.equal(row.figure.querySelector('.painted-stage'),row.stage);
    assert.equal(row.figure.style.cssText,row.geometry);
    assert.equal(row.image.src,map.get(catalog.sprites[row.figure.dataset.alternativeSprite].path));
    assert.equal(row.figure.hasAttribute('data-art-placeholder'),false);
  }
  assert.equal(restoreArtPlaceholders(root),0,'each failed figure restores once');
});

test('a mounted bare variant URL moves to its verified common object after Retry, unknown URLs stay unchanged',()=>{
  const id='assets-alternative/graveWisp.webp';
  const image=new Image();image.src=id;root.append(image);
  const unknown=new Image();unknown.src='assets-alternative/unlisted.webp';root.append(unknown);
  const map=new Map([[id,objectFor(id)]]);setBuiltInSource(map);
  assert.equal(builtInArtArrived(map),1);
  assert.equal(image.src,objectFor(id));
  assert.equal(currentArtUrl(id),objectFor(id));
  assert.equal(unknown.src,'assets-alternative/unlisted.webp');
  assert.equal(currentArtUrl(unknown.src),unknown.src);
});

test('normal catalog figures retain the authored canvas, alpha crop, and resolved URLs without placeholders',()=>{
  const map=new Map(Object.values(catalog.sprites).map(art=>[art.path,objectFor(art.path)]));setBuiltInSource(map);
  for(const [id,art] of Object.entries(catalog.sprites)){
    const figure=alternativeSprite(id),image=figure.querySelector('img');
    const [w,h]=art.size,[x0,y0,x1,y1]=art.bounds,scale=190/(y1-y0);
    assert.equal(figure.style.cssText,`width:${(x1-x0)*scale}px;height:190px;position:relative;flex:none`);
    assert.equal(image.style.cssText,`position:absolute;width:${w*scale}px;height:${h*scale}px;left:${-x0*scale}px;top:${-y0*scale}px;max-width:none`);
    assert.equal(image.src,objectFor(art.path));
    assert.equal(figure.hasAttribute('data-art-placeholder'),false);
    assert.equal(figure.querySelector('span'),null);
  }
});

test('a second failed load remains restorable rather than losing its placeholder callback',()=>{
  const figure=alternativeSprite('graveWisp');root.append(figure);const image=figure.querySelector('img');
  image.dispatch('error');assert.equal(restoreArtPlaceholders(root),1);
  image.dispatch('error');assert.equal(figure.hasAttribute('data-art-placeholder'),true);
  const id=catalog.sprites.graveWisp.path;setBuiltInSource(new Map([[id,objectFor(id)]]));
  assert.equal(restoreArtPlaceholders(root),1);
  assert.equal(figure.querySelector('img'),image);assert.equal(image.src,objectFor(id));
  assert.equal(restoreArtPlaceholders(root),0);
});
