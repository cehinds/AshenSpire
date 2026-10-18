import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simpleCardArt } from '../src/ui/cardArtComposition.js';
import { layeredCardArtCatalog as catalog } from '../src/content/layeredCardArt.generated.js';
import { cardArtLayersHtml } from '../src/ui/cardArtLayers.js';
import { cardCutoutAssets, withCardCutouts } from '../tools/card-cutout-assets.mjs';
import { renderCard } from '../src/ui/components/card.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { runInNewContext } from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const math = {};
runInNewContext(readFileSync(new URL('../docs/design/new-card-art/layer-math.js', import.meta.url), 'utf8'), math);
const art = (camp, maneuver, extra = {}) => simpleCardArt({id:'custom', type:'attack', cardTags:[`camp:${camp}`, `maneuver:${maneuver}`, ...(extra.tags || [])], ...extra});

test('approved PNGs are packaged byte-for-byte and generated JSON agrees with runtime', () => {
  const json = JSON.parse(readFileSync(new URL('../asset-data/card-art/layered-runtime.json', import.meta.url)));
  assert.deepEqual(catalog, json);
  const assets = cardCutoutAssets(root);
  assert.equal(assets.length, 44);
  const manifest = withCardCutouts({schema:2,assets:{}}, root);
  for (const asset of assets) {
    assert.equal(asset.bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(manifest.assets[asset.id].common.sha256, asset.sha256);
  }
  assert.throws(() => withCardCutouts(manifest, root), /collides/);
});
test('one physical model per action, scythe for Sweep and independent sword/shield for Counter', () => {
  for (const [maneuver, id] of [['attack','O.object.0'],['smash','O.object.1'],['sweep','L.object.4'],['defend','O.object.4'],['counter','O.object.4']]) {
    const a = art('physical',maneuver);
    assert.equal(a.componentArt.sprites.find(l=>l.id==='object').assetId,id);
    assert.equal(a.componentArt.sprites.filter(l=>l.id==='secondaryObject').length,maneuver==='counter'?1:0);
    const another = art('physical',maneuver,{id:'different', art:{variant:5}});
    assert.deepEqual(a.componentArt,another.componentArt);
  }
});
test('melee preserves all ten approved transforms, opacity, shared small sprite and shaft alignment', () => {
  const source = JSON.parse(readFileSync(new URL('../docs/design/new-card-art/cutout-manifest.json', import.meta.url)));
  for (let i=0;i<10;i++) {
    const code=`Y0${i}`, approved=source.compositions[code], runtime=catalog.compositions[code];
    for (const layer of runtime.layers) {
      const resolved=JSON.parse(JSON.stringify(math.CardLayerMath.resolve(source,approved,approved.layers.find(l=>l.id===layer.id))));
      assert.deepEqual(layer.css,resolved.css);
      assert.deepEqual(layer.affine,resolved.affine.map(n => n || 0));
    }
    const scepter=runtime.layers.find(l=>l.id==='object'), weapon=runtime.layers.find(l=>l.id==='foreground');
    assert.equal(scepter.assetId,'V.object.0');
    assert.equal(scepter.transform.width,152.95);
    assert.equal(scepter.transform.height,152.95);
    assert.equal(weapon.transform.opacity,i<5?.4:.2);
    assert.notEqual(scepter.assetId,weapon.assetId);
  }
  assert.equal(art('spell','sweep',{tags:['school:alteration']}).componentArt.code,'Y07');
  assert.equal(art('spell','smash',{tags:['school:frost']}).componentArt.code,'Y01');
});
test('ranged delivery chooses the right separate projectile; misleading names do not', () => {
  for (const [element, digit] of Object.entries(catalog.selection.projectiles)) {
    const a=art('spell','casting',{tags:['delivery:projectile',`element:${element}`]});
    assert.equal(a.componentArt.code,`Z0${digit}`);
    assert.equal(a.componentArt.sprites.find(l=>l.id==='foreground').assetId,`Z.effect.${digit}`);
  }
  assert.equal(art('spell','attack',{id:'fireProjectile',name:'Fire Projectile'}).componentArt.code,'Y00');
});
test('utility uses actual effects, cleanse is fire, empty or conflicting identities still fall back', () => {
  const reg=createRegistries(contentBundle);
  for(const [id,code] of [['urgentHeal','G00'],['sanctuaryCleanse','H00']]) {
    assert.equal(simpleCardArt(resolveCard(reg,{cardId:id}),{registries:reg}).componentArt.code,code);
  }
  const a=art('spell','casting',{type:'skill',effects:[{op:'conditional',then:[{op:'draw',amount:2}]}]});
  assert.equal(a.componentArt.code,'F00');
  assert.equal(art('spell','casting',{type:'skill',effects:[{op:'removeStatus',target:'enemy',status:'strength'}]}).componentArt.code,'I00');
  assert.equal(simpleCardArt({type:'skill',cardTags:[],effects:[{op:'draw'}]}),null);
  assert.equal(art('spell','attack',{tags:['camp:physical']}),null);
});
test('primary action plus at most three secondary identities; definitions stay untouched', () => {
  const def={type:'attack',cardTags:['camp:spell','maneuver:attack','element:fire'],effects:['bleeding','frozen','weak'].map(status=>({op:'applyStatus',status}))};
  const before=structuredClone(def), a=simpleCardArt(def);
  assert.equal(a.layers.length,3);
  assert.equal(a.statuses.length,2);
  assert.deepEqual(def,before);
  assert.match(cardArtLayersHtml(a),/data-card-art-component="V.object.0"/);
});
test('a failed object PNG falls back the whole composition, then legacy image failures continue normally', () => {
  withModalDom(()=>{
    const reg=createRegistries(contentBundle), card=renderCard(reg,{cardId:'strike',profileId:'bladeAttack'},{inspection:false});
    document.body.append(card);
    const base=card.querySelector('.playing-card-art');
    const object=card.querySelector('[data-card-art-component="O.object.0"]');
    assert.ok(object);
    object.dispatchEvent(new Event('error'));
    assert.equal(base.dataset.cardArt,'official');
    assert.equal(card.querySelector('[data-card-art-layers]'),null);
    object.dispatchEvent(new Event('error'));
    assert.equal(base.dataset.cardArt,'official');
    base.dispatchEvent(new Event('error'));
    assert.equal(base.dataset.cardArt,'outline');
  });
});
