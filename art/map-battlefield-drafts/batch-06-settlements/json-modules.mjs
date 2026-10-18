import {gameAsset} from '../paired-game.mjs';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {checkStyleAsset,loadStyleLibrary,familyId} from '../style-system/art-style.mjs';

const defaultIndex = fileURLToPath(new URL('./modules/index.json', import.meta.url));
const read = path => JSON.parse(readFileSync(path, 'utf8'));

function unique(records, key, label) {
  const ids = new Set();
  for (const record of records) {
    if (typeof record[key] !== 'string' || !record[key] || ids.has(record[key])) {
      throw new Error(`${label}: missing or duplicate ${key}: ${record[key]}`);
    }
    ids.add(record[key]);
  }
  return ids;
}

/** Plain JSON modules; no dependency on JSON import assertions or a bundler. */
export function loadArtModules(indexPath = defaultIndex) {
  const index = read(indexPath);
  if (index.schemaVersion !== 1) throw new Error('Unsupported art module schema version');
  const moduleRoot = dirname(indexPath);
  const assetBase = resolve(moduleRoot, index.assetBase);
  if(index.styleFamilyId!==familyId)throw new Error('Missing or mismatched art module style family');
  const styleLibrary=loadStyleLibrary();
  const requireStyle=(file,role)=>{
    const errors=checkStyleAsset(styleLibrary,resolve(assetBase,file),[role]);
    if(errors.length)throw new Error(errors.join('\n'));
  };
  const shared = name => read(resolve(moduleRoot, index.shared[name]));
  const profiles = [];
  const presets = [];
  unique(index.regions, 'regionId', 'Region index');
  for (const entry of index.regions) {
    for (const [kind, collection, target] of [['pools', 'profiles', profiles], ['scenes', 'presets', presets]]) {
      const path = resolve(moduleRoot, entry[kind]);
      const module = read(path);
      if (module.regionId !== entry.regionId || !Array.isArray(module[collection])) {
        throw new Error(`Invalid ${kind} module: ${path}`);
      }
      for (const record of module[collection]) {
        const region = kind === 'pools' ? record.selectionTags?.region : record.regionId;
        const id = kind === 'pools' ? record.profileId : record.id;
        if (region !== entry.regionId || !id?.startsWith(entry.regionId + '/')) {
          throw new Error(`Region mismatch in ${path}: ${id}`);
        }
        target.push(record);
      }
    }
  }
  unique(profiles, 'profileId', 'Location pools');
  const sceneIds = unique(presets, 'id', 'Compositions');
  const order = index.sceneOrder ?? [];
  if (new Set(order).size !== order.length || order.some(id => !sceneIds.has(id))) {
    throw new Error('sceneOrder contains duplicate or unknown scene IDs');
  }
  // Existing presentation order is stable; newly added scenes append automatically.
  const rank = new Map(order.map((id, i) => [id, i]));
  presets.sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
  const locationPools = {...shared('locationPools'), profiles};
  const composition = {...shared('composition'), presets};

  const requireFile = path => {
    if (typeof path !== 'string' || !existsSync(path.startsWith('../../../content/') ? gameAsset(path.slice(9)) : resolve(assetBase, path))) {
      throw new Error(`Missing art/source reference: ${path}`);
    }
  };
  for (const profile of profiles) {
    requireFile(profile.assignmentSource.path);
    for (const pool of [...profile.primaryPools, ...profile.fallbackPools]) {
      for (const path of [pool.ground, pool.backdrop, ...pool.props]) requireFile(path);
      requireStyle(pool.ground,'battlefield-ground');
      requireStyle(pool.backdrop,'battlefield-backdrop');
      for(const file of pool.props)requireStyle(file,'battlefield-prop');
    }
  }
  for (const preset of presets) {
    for (const path of [preset.ground, preset.backdrop, ...preset.props.map(prop => prop.file)]) requireFile(path);
    requireStyle(preset.ground,'battlefield-ground');
    requireStyle(preset.backdrop,'battlefield-backdrop');
    for(const prop of preset.props)requireStyle(prop.file,'battlefield-prop');
  }
  for (const name of ['locationPresentation', 'worldAtlas', 'fallbackCandidates']) {
    requireFile(locationPools.provenance[name]);
  }
  return {assetBase, locationPools, composition};
}

export function exportArtModules(indexPath = defaultIndex) {
  const data = loadArtModules(indexPath);
  for (const [file, value] of [
    ['location-pools.example.json', data.locationPools],
    ['composition.example.json', data.composition],
  ]) {
    writeFileSync(resolve(data.assetBase, file), JSON.stringify(value, null, 2) + '\n');
  }
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check') || args.length > 1) {
    throw new Error('Usage: node json-modules.mjs [--check]');
  }
  const data = args.includes('--check') ? loadArtModules() : exportArtModules();
  console.log(`${args.includes('--check') ? 'Validated' : 'Exported'} ${data.locationPools.profiles.length} profiles and ${data.composition.presets.length} compositions from JSON modules.`);
}
