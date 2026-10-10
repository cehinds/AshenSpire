import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { alternativeSprite, alternativeCompanionIcon } from '../src/ui/alternativeArt.js';
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
  setAttribute(key,value) { this.attrs[key]=String(value); if(key==='src'||key==='srcset')this[key]=String(value); }
  getAttribute(key) { return key==='src'||key==='srcset' ? this[key] ?? null : this.attrs[key] ?? null; }
  hasAttribute(key) { return key in this.attrs; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type,listener) { (this.listeners[type]??=[]).push(listener); }
  dispatch(type) { for(const listener of this.listeners[type]??[]) listener({type,target:this}); }
  querySelector(selector) { return this.querySelectorAll(selector)[0]??null; }
  querySelectorAll(selector) {
    const found=[];
    const matches=node=>selector.split(',').some(part=>{
      const sel=part.trim();
      if(sel==='img[src]')return node.tagName==='IMG'&&node.getAttribute('src')!==null;
      if(sel==='source[srcset]')return node.tagName==='SOURCE'&&node.getAttribute('srcset')!==null;
      if(sel.startsWith('['))return node.hasAttribute(sel.slice(1,-1));
      if(sel.startsWith('.'))return node.className.split(' ').includes(sel.slice(1));
      return node.tagName===sel.toUpperCase();
    });
    const visit=node=>{for(const child of node.children){if(matches(child))found.push(child);visit(child);}};
    visit(this);return found;
  }
}
let root;
beforeEach(()=>{
  resetHighResArt(); setBuiltInSource(null); root=new Element('main');
  globalThis.document={createElement:tag=>new Element(tag),querySelectorAll:selector=>root.querySelectorAll(selector)};
  globalThis.Image=class extends Element { constructor(){super('img');} };
});
afterEach(()=>{delete globalThis.document;delete globalThis.Image;resetHighResArt();setBuiltInSource(null);});
const objectFor=id=>{const hash=catalog.hashes[id.split('/').at(-1)];return `objects/${hash.slice(0,2)}/${hash}.webp`;};

test('legacy alternative and player figures become marked placeholders and Retry restores the same authored crop',()=>{
  const figures=[alternativeSprite('graveWisp'),playerSprite({},'reaver','default')];
  root.append(...figures);
  const originals=figures.map(figure=>({figure,image:figure.querySelector('img'),picture:figure.querySelector('picture'),mobile:figure.querySelector('source'),crop:figure.querySelector('.alternative-crop'),stage:figure.querySelector('.painted-stage'),geometry:figure.style.cssText}));
  for(const row of originals){
    row.image.dispatch('error');
    assert.equal(row.figure.querySelector('img'),null);
    assert.equal(row.figure.querySelector('picture'),null,'the responsive picture is hidden with the failed figure');
    assert.equal(row.image.parentNode,row.picture,'failure preserves picture children for Retry');
    assert.equal(row.mobile.parentNode,row.picture);
    assert.equal(row.figure.hasAttribute('data-art-placeholder'),true);
    assert.equal(row.figure.querySelector('span').getAttribute('role'),'img');
    assert.equal(row.figure.style.cssText,row.geometry);
  }
  const map=new Map(originals.flatMap(row=>[row.image.src,row.mobile.srcset].map(id=>[id,objectFor(id)])));
  setBuiltInSource(map); builtInArtArrived(map);
  assert.equal(restoreArtPlaceholders(root),2);
  for(const row of originals){
    assert.equal(row.figure.parentNode,root,'the screen/figure is not replaced');
    assert.equal(row.figure.querySelector('img'),row.image,'the same image returns');
    assert.equal(row.figure.querySelector('picture'),row.picture,'the same responsive picture returns');
    assert.equal(row.figure.querySelector('source'),row.mobile,'the same phone source returns');
    assert.equal(row.mobile.media,'(max-width: 599px)');
    assert.equal(row.figure.querySelector('.alternative-crop'),row.crop);
    assert.equal(row.figure.querySelector('.painted-stage'),row.stage);
    assert.equal(row.figure.style.cssText,row.geometry);
    assert.equal(row.image.src,map.get(catalog.sprites[row.figure.dataset.alternativeSprite].path));
    assert.equal(row.mobile.srcset,map.get(catalog.sprites[row.figure.dataset.alternativeSprite].mobilePath));
    assert.equal(row.figure.hasAttribute('data-art-placeholder'),false);
  }
  assert.equal(restoreArtPlaceholders(root),0,'each failed figure restores once');
});

test('expanded enemy art retries through the verified pack without replacing its stage',()=>{
  const figure=enemySprite({id:'graveWisp'}); root.append(figure);
  const image=figure.querySelector('img'), geometry=figure.style.cssText, id=image.src;
  image.dispatch('error');
  assert.equal(image.style.visibility,'hidden');
  assert.equal(figure.hasAttribute('data-art-placeholder'),true);
  assert.equal(figure.querySelector('span').getAttribute('role'),'img');
  assert.equal(figure.querySelector('span').style.display,'flex','the failed frame exposes its rendered fallback');
  const url='objects/enemy-expansion-idle.webp';
  setBuiltInSource(new Map([[id,url]]));
  assert.equal(restoreArtPlaceholders(root),1);
  assert.equal(image.src,url);
  image.dispatch('load');
  assert.equal(image.style.visibility,'');
  assert.equal(figure.querySelector('span').style.display,'none');
  assert.equal(figure.style.cssText,geometry);
  assert.equal(figure.querySelector('img'),image);
});

test('a mounted bare variant URL moves to its verified common object after Retry, unknown URLs stay unchanged',()=>{
  const id='assets-display/alternative/graveWisp.webp';
  const image=new Image();image.src=id;root.append(image);
  const unknown=new Image();unknown.src='assets-display/alternative/unlisted.webp';root.append(unknown);
  const map=new Map([[id,objectFor(id)]]);setBuiltInSource(map);
  assert.equal(builtInArtArrived(map),1);
  assert.equal(image.src,objectFor(id));
  assert.equal(currentArtUrl(id),objectFor(id));
  assert.equal(unknown.src,'assets-display/alternative/unlisted.webp');
  assert.equal(currentArtUrl(unknown.src),unknown.src);
});

test('normal catalog figures retain the authored canvas, alpha crop, and resolved URLs without placeholders',()=>{
  const map=new Map(Object.values(catalog.sprites).flatMap(art=>[art.path,art.mobilePath].map(id=>[id,objectFor(id)])));setBuiltInSource(map);
  for(const [id,art] of Object.entries(catalog.sprites)){
    const figure=alternativeSprite(id),image=figure.querySelector('img');
    const [w,h]=art.size,[x0,y0,x1,y1]=art.bounds,scale=190/(y1-y0);
    assert.equal(figure.style.cssText,`width:${(x1-x0)*scale}px;height:190px;position:relative;flex:none`);
    assert.equal(image.style.cssText,`position:absolute;width:${w*scale}px;height:${h*scale}px;left:${-x0*scale}px;top:${-y0*scale}px;max-width:none`);
    assert.equal(image.src,objectFor(art.path));
    assert.equal(figure.querySelector('source').srcset,objectFor(art.mobilePath));
    assert.equal(figure.querySelector('source').media,'(max-width: 599px)');
    assert.equal(image.parentNode,figure.querySelector('picture'));
    assert.equal(figure.dataset.poseCoverage,'idle');
    assert.equal(figure.hasAttribute('data-art-placeholder'),false);
    assert.equal(figure.querySelector('span'),null);
  }
});

test('a second failed load remains restorable rather than losing its placeholder callback',()=>{
  const figure=alternativeSprite('graveWisp');root.append(figure);const image=figure.querySelector('img');
  image.dispatch('error');assert.equal(restoreArtPlaceholders(root),1);
  image.dispatch('error');assert.equal(figure.hasAttribute('data-art-placeholder'),true);
  const id=catalog.sprites.graveWisp.path,mobileId=catalog.sprites.graveWisp.mobilePath;setBuiltInSource(new Map([[id,objectFor(id)],[mobileId,objectFor(mobileId)]]));
  assert.equal(restoreArtPlaceholders(root),1);
  assert.equal(figure.querySelector('img'),image);assert.equal(image.src,objectFor(id));
  assert.equal(figure.querySelector('source').srcset,objectFor(mobileId));
  assert.equal(restoreArtPlaceholders(root),0);
});

test('a failed phone selection restores its dedicated mobile URL without replacing it with desktop art',()=>{
  const art=catalog.sprites.graveWisp,figure=alternativeSprite('graveWisp');root.append(figure);
  const picture=figure.querySelector('picture'),source=figure.querySelector('source'),image=figure.querySelector('img');
  image.currentSrc=source.srcset; // A phone chose the authored <source>, whose failure surfaces on <img>.
  assert.equal(image.currentSrc,art.mobilePath);
  image.dispatch('error');
  const map=new Map([[art.path,objectFor(art.path)],[art.mobilePath,objectFor(art.mobilePath)]]);
  setBuiltInSource(map);builtInArtArrived(map);
  assert.equal(restoreArtPlaceholders(root),1);
  assert.equal(figure.querySelector('picture'),picture);
  assert.equal(picture.querySelector('source'),source);
  assert.equal(picture.querySelector('img'),image);
  assert.equal(source.srcset,map.get(art.mobilePath));
  assert.equal(image.src,map.get(art.path));
  assert.equal(source.media,'(max-width: 599px)','the phone retains its authored responsive source even when bytes are shared');
  assert.equal(currentArtUrl(art.mobilePath),map.get(art.mobilePath),'verified mobile IDs use the same resolver');
});

test('incoming companion icons keep their responsive picture, identity, and decorative contract',()=>{
  for(const [id,art] of Object.entries(catalog.sprites).filter(([,art])=>art.family==='companion')){
    const map=new Map([[art.path,objectFor(art.path)],[art.mobilePath,objectFor(art.mobilePath)]]);setBuiltInSource(map);
    const picture=alternativeCompanionIcon(id);
    assert.equal(picture.className,'alternative-companion-icon');
    assert.equal(picture.dataset.alternativeSprite,id);
    assert.equal(picture.getAttribute('aria-hidden'),'true');
    assert.equal(picture.querySelector('img').alt,'');
    assert.equal(picture.querySelector('img').src,map.get(art.path));
    assert.equal(picture.querySelector('source').srcset,map.get(art.mobilePath));
    assert.equal(picture.querySelector('source').media,'(max-width: 599px)');
  }
  assert.equal(alternativeCompanionIcon('graveWisp'),null);
});

test('tier arrival refreshes mounted phone and desktop sources while preserving responsive formats',()=>{
  const art=catalog.sprites.graveWisp,figure=alternativeSprite('graveWisp');root.append(figure);
  const image=figure.querySelector('img'),source=figure.querySelector('source');
  const alternatives=new Element('source');
  alternatives.srcset=`  ${art.mobilePath} 1x ,\t${art.path} 2x  `;
  root.append(alternatives);
  const unknown=new Element('source');
  const untouched='https://example.test/unlisted.webp 1x, data:image/webp;base64,AAAA 2x, assets-display/alternative/unlisted.webp 3x';
  unknown.srcset=untouched;root.append(unknown);
  const map=new Map([[art.path,objectFor(art.path)],[art.mobilePath,objectFor(art.mobilePath)]]);
  setBuiltInSource(map);
  assert.equal(builtInArtArrived(map),3,'the image, phone source and multi-candidate source all refresh');
  assert.equal(image.src,map.get(art.path));
  assert.equal(source.srcset,map.get(art.mobilePath));
  assert.equal(source.media,'(max-width: 599px)');
  assert.equal(alternatives.srcset,`  ${map.get(art.mobilePath)} 1x ,\t${map.get(art.path)} 2x  `);
  assert.equal(unknown.srcset,untouched);
  // Byte-identical catalog aliases also share their verified URL in the next tier.
  const next=new Map([art.path,art.mobilePath].map(id=>[id,`objects/next-${catalog.hashes[id.split('/').at(-1)]}.webp`]));
  setBuiltInSource(next);
  assert.equal(builtInArtArrived(next),3,'earlier verified object URLs are tracked to their authored IDs');
  assert.equal(source.srcset,next.get(art.mobilePath));
  assert.equal(image.src,next.get(art.path));
  assert.equal(alternatives.srcset,`  ${next.get(art.mobilePath)} 1x ,\t${next.get(art.path)} 2x  `);
  assert.equal(unknown.srcset,untouched);
  assert.equal(builtInArtArrived(next),0,'an unchanged tier does not rewrite responsive attributes');
});
