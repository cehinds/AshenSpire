#!/usr/bin/env node
// Compile the approved review snapshot. PNGs remain separately addressable.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {sameLfCanonicalText} from './working-tree-text.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = JSON.parse(readFileSync(root+'asset-data/card-art/reviewed-library.json', 'utf8'));
const importAt = process.argv.indexOf('--import');
if (importAt !== -1) {
  if (!process.argv[importAt+1] || process.argv.includes('--check')) throw Error('Use --import <exported JSON> without --check');
  const edited = JSON.parse(readFileSync(process.argv[importAt+1], 'utf8'));
  for (const row of source.rows) {
    const sprites = edited.catalog?.records?.[row.id]?.sprites;
    if (!sprites || sprites.length !== row.layers.length) throw Error(`Layer count changed: ${row.id}`);
    row.layers = row.layers.map((layer,index) => {
      const sprite = sprites[index];
      if (sprite.assetId !== layer.assetId) throw Error(`Component identity changed: ${row.id}`);
      if (layer.role === 'background') {
        // Neither preview nor the game renderer applies background transforms, so refuse them.
        const keys = ['x','y','width','height','rotation','opacity'];
        const same = keys.every(k => sprite.transform?.[k] === layer[k]) && JSON.stringify(sprite.affine) === JSON.stringify(layer.affine ?? sprite.affine);
        if (!same) throw Error(`Background transform edits are not supported: ${row.id}`);
        return layer;
      }
      return {...layer,...sprite.transform,affine:sprite.affine};
    });
  }
}
const existing = JSON.parse(readFileSync(root+'asset-data/card-art/layered-runtime.json', 'utf8'));
// Effect layers: one approved PNG per presentation `fx:` tag, painted by the procedural Simple art (src/ui/proceduralCardArt.js).
const effectLayers = source.effectLayers || {};
const proceduralObjects = source.proceduralObjects || {};
const modifiers = source.proceduralModifiers;
const used = new Set([
  ...source.rows.flatMap(row => row.layers.map(layer => layer.assetId)),
  ...Object.values(effectLayers).map(layer => layer.assetId),
  ...Object.values(proceduralObjects).map(layer => layer.assetId),
  modifiers.chevrons.assetId,
  ...Object.values(modifiers.stats).map(stat => stat.assetId).filter(Boolean),
]);
const assets = Object.fromEntries([...used].map(id => {
  const a = source.assets[id];
  if (!a?.path || !a.sha256 || !a.bytes) throw Error(`Unregistered PNG: ${id}`);
  return [id, {id, path:a.path, name:a.label, sha256:a.sha256, bytes:a.bytes, width:a.width, height:a.height}];
}));
/** One authored layer (512 x 640 well coordinates) as a positioned sprite. */
function compileSprite(layer, index, owner, id) {
  const {assetId, x, y, width, height, rotation, opacity, blendMode, affine} = layer;
  if (![x,y,width,height,rotation,opacity].every(Number.isFinite) || width<=0 || height<=0 || opacity<0 || opacity>1) throw Error(`Invalid transform: ${owner}`);
  if (!['normal','screen','multiply','overlay','soft-light'].includes(blendMode)) throw Error(`Invalid blend: ${owner}`);
  const matrix = affine || [Math.cos(rotation*Math.PI/180),Math.sin(rotation*Math.PI/180),-Math.sin(rotation*Math.PI/180),Math.cos(rotation*Math.PI/180)];
  if (matrix.length !== 4 || !matrix.every(Number.isFinite)) throw Error(`Invalid matrix: ${owner}`);
  return {id, assetId, path:assets[assetId].path, label:assets[assetId].name,
    transform:{x,y,width,height,rotation,opacity,blendMode}, affine:matrix,
    css:{position:'absolute',left:`${x/512*100}%`,top:`${y/640*100}%`,width:`${width/512*100}%`,height:`${height/640*100}%`,objectFit:'contain',transformOrigin:'50% 50%',transform:`translate(-50%, -50%) matrix(${matrix.join(',')},0,0)`,opacity:String(opacity),mixBlendMode:blendMode,pointerEvents:'none',zIndex:String(index)}};
}
const records = Object.fromEntries(source.rows.map(row => {
  if (row.visualCues.length > 4) throw Error(`Too many cues: ${row.id}`);
  const sprites = row.layers.map((layer, index) => compileSprite(layer, index, row.id, layer.role==='background'?'background':`${layer.role}-${index}`));
  if (sprites.filter(s=>s.id==='background').length!==1) throw Error(`Background required: ${row.id}`);
  return [row.id,{code:row.code,label:row.name,rule:row.rule,tags:row.tags,visualCues:row.visualCues,sprites,path:sprites.find(s=>s.id==='background').path,coordinateSpace:{width:512,height:640},maxVisibleTags:4}];
}));
const effects = Object.fromEntries(Object.entries(effectLayers).map(([tag, layer]) => {
  if (!/^fx:[a-z]+$/.test(tag)) throw Error(`Effect layer key must be an fx: tag: ${tag}`);
  if (layer.role !== 'effect') throw Error(`Effect layer role must be effect: ${tag}`);
  return [tag, compileSprite(layer, 0, tag, `fx-${tag.slice(3)}`)];
}));
const objects = Object.fromEntries(Object.entries(proceduralObjects).map(([action, layer]) => {
  if (layer.role !== 'object') throw Error(`Procedural object role must be object: ${action}`);
  return [action, compileSprite(layer, 0, action, 'object')];
}));
for (const [id, stat] of Object.entries(modifiers.stats)) {
  if (!/^[a-z]+$/.test(id) || !Array.isArray(stat.statuses)
    || !stat.statuses.every(status => typeof status === 'string')
    || (stat.assetId !== null && !assets[stat.assetId])) throw Error(`Invalid procedural modifier: ${id}`);
}
const { priority, statAliases, object, chevrons } = modifiers;
const statIds = Object.keys(modifiers.stats);
if (!Array.isArray(priority) || new Set(priority).size !== statIds.length || priority.length !== statIds.length
  || !priority.every(id => Object.hasOwn(modifiers.stats, id))) throw Error('Modifier priority must list each stat once');
for (const [key, required] of Object.entries({
  stanceActions: ['attack', 'smash', 'sweep', 'defend', 'counter', 'evade'],
  effectGroupOrder: ['secondary', 'main'],
  effectObjectOrder: ['stat', 'utility', 'status'],
  layerOrder: ['background', 'chevrons', 'aura', 'object', 'effect', 'projectile'],
})) {
  const values = modifiers[key];
  if (!Array.isArray(values) || values.length !== required.length || !required.every(value => values.includes(value))) {
    throw Error(`Invalid modifier policy: ${key}`);
  }
}
if (!Number.isFinite(modifiers.aura.stanceOpacity) || modifiers.aura.stanceOpacity < 0 || modifiers.aura.stanceOpacity > 1) {
  throw Error('Invalid stance modifier aura opacity');
}
for (const [alias, id] of Object.entries(statAliases)) {
  if (!/^[a-z]+$/.test(alias) || Object.hasOwn(modifiers.stats, alias) || !Object.hasOwn(modifiers.stats, id)) {
    throw Error(`Invalid modifier alias: ${alias}`);
  }
}
if (![object.tintStrength, object.edgeTintStrength, object.edgeWidth, object.edgeSoftness].every(Number.isFinite)
  || !(0 <= object.tintStrength && object.tintStrength <= object.edgeTintStrength && object.edgeTintStrength < 1)
  || !(0 < object.edgeSoftness && object.edgeSoftness <= object.edgeWidth && object.edgeWidth < 0.5)) {
  throw Error('Invalid modifier object tint');
}
if (![chevrons.opposingX, chevrons.opposingScale, chevrons.glowRadius].every(Number.isFinite)
  || chevrons.opposingX < 0 || chevrons.opposingScale <= 0 || chevrons.glowRadius < 0
  || chevrons.opposingX + chevrons.width * chevrons.opposingScale / 2 > chevrons.width / 2
  || chevrons.opposingScale > 1) throw Error('Invalid modifier accents');
const { center } = modifiers;
if (!(Number.isFinite(center.objectScale) && center.objectScale > 0)
  || ![center.chevronsOffsetY, center.objectOffsetY].every(Number.isFinite)
  || Object.values(modifiers.stats).some(({ centerObjectScale }) => centerObjectScale !== undefined
    && !(Number.isFinite(centerObjectScale) && centerObjectScale > 0))) throw Error('Invalid modifier center layout');
for (const layout of [modifiers.center]) {
  if (![layout.x, layout.y, layout.width, layout.height, layout.maxSize].every(Number.isFinite)
    || Math.min(layout.width, layout.height, layout.maxSize) <= 0
    || layout.x < 0 || layout.y < 0 || layout.x + layout.width > 512 || layout.y + layout.height > 640) {
    throw Error('Modifier layout must fit the card art well');
  }
}
for (const polarity of ['buff', 'debuff']) {
  const style = modifiers.polarities[polarity];
  if (![style.tint, style.aura].every(value => typeof value === 'string' && value.length > 0)) throw Error(`Invalid modifier tint: ${polarity}`);
  if (style.rgb?.length !== 3 || !style.rgb.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 1)
    || !Number.isFinite(style.scale) || style.scale <= 0 || !/^#[0-9a-f]{6}$/i.test(style.glow)) {
    throw Error(`Invalid modifier luminance tint: ${polarity}`);
  }
  for (const layer of [modifiers.object, modifiers.aura, {...modifiers.chevrons,rotation:style.rotation}]) {
    compileSprite({...layer, assetId:modifiers.chevrons.assetId}, 0, polarity, 'modifier');
  }
}
const runtime = {schema:1,sourceCommit:source.sourceCommit,reviewPage:source.reviewPage,assets,records,effectLayers:effects,
  proceduralObjects:objects,proceduralModifiers:modifiers};
const outputs = {
  'src/content/reviewedCardArt.generated.js':'// Generated by tools/export-reviewed-card-art.mjs; edit asset-data/card-art/reviewed-library.json.\nexport const reviewedCardArtCatalog = '+JSON.stringify(runtime)+';\n',
  'asset-data/card-art/reviewed-assets.json':JSON.stringify({schema:1,assets:Object.fromEntries(Object.entries(assets).filter(([id])=>!Object.hasOwn(existing.assets,id)))},null,2)+'\n',
};
for (const [file,content] of Object.entries(outputs)) {
  if (process.argv.includes('--check')) {if(!sameLfCanonicalText(readFileSync(root+file,'utf8'),content))throw Error(`Stale export: ${file}`);}
  else writeFileSync(root+file,content);
}
if (importAt !== -1) writeFileSync(root+'asset-data/card-art/reviewed-library.json',JSON.stringify(source,null,2)+'\n');
console.log(`Compiled ${Object.keys(records).length} reviewed recipes / ${used.size} separate PNGs`);
