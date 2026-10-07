import { locationPresentation as data } from '../content/generated/locationPresentation.js';
import { ENVIRONMENTS } from '../content/environments.js';

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const profiles = new Map(data.profiles.map(p => [p.profileId, p]));
const nodeProfiles = new Map(data.nodeProfiles.map(n => [n.nodeId, n.profileId]));
const sceneMeta = new Map(data.scenes.map(s => [s.sceneId, s]));
const art = new Map(ENVIRONMENTS.flatMap(region => region.scenes.map(scene => [scene.id, { region, scene }])));

export function presentationProblems(tables = data) {
  const errors = [];
  for (const [table, key] of [['settings','settingId'],['times','timeId'],['weather','weatherId'],['profiles','profileId'],['nodeProfiles','nodeId'],['scenes','sceneId'],['music','musicId']]) {
    const seen = new Set();
    for (const row of tables[table]) { if (seen.has(row[key])) errors.push(`${table}: duplicate ${row[key]}`); seen.add(row[key]); }
  }
  const has = (table, key, id) => tables[table].some(row => row[key] === id);
  const profileKeys = new Set();
  for (const p of tables.profiles) {
    const key = `${p.regionId}/${p.settingId}`;
    if (profileKeys.has(key)) errors.push(`Duplicate profile setting ${key}`);
    profileKeys.add(key);
    if (!has('settings','settingId',p.settingId) || !ENVIRONMENTS.some(r=>r.id===p.regionId)) errors.push(`Invalid profile ${p.profileId}`);
    if (!tables.sceneProfiles.some(s=>s.profileId===p.profileId)) errors.push(`No scenes for ${p.profileId}`);
  }
  for (const n of tables.nodeProfiles) if (!has('profiles','profileId',n.profileId)) errors.push(`Unknown profile for ${n.nodeId}`);
  for (const s of tables.scenes) if (!art.has(s.sceneId) || !has('times','timeId',s.timeId) || !has('weather','weatherId',s.weatherId)) errors.push(`Invalid scene ${s.sceneId}`);
  for (const [table, catalog, id] of [['sceneProfiles','scenes','sceneId'],['musicProfiles','music','musicId']]) {
    const seen = new Set();
    for (const row of tables[table]) {
      const key = `${row.profileId}/${row[id]}`;
      if (seen.has(key) || !has('profiles','profileId',row.profileId) || !has(catalog,id,row[id]) || !(Number.isFinite(row.weight) && row.weight > 0)) errors.push(`Invalid ${table} ${key}`);
      if (catalog === 'scenes' && art.has(row.sceneId)) {
        const profile = tables.profiles.find(p => p.profileId === row.profileId);
        if (profile && art.get(row.sceneId).region.id !== profile.regionId) errors.push(`Biome mismatch ${key}`);
      }
      seen.add(key);
    }
  }
  return errors;
}

// Separate presentation hashing never consumes gameplay RNG. Time/weather may
// relax, but setting and biome never do. Return the fallback for authoring QA.
export function resolveLocationPresentation({ nodeId, seedString = '', profileId, timeId = 'day', weatherId = 'any', savedSceneId } = {}) {
  profileId = nodeProfiles.get(nodeId) || profileId;
  const profile = profiles.get(profileId);
  if (!profile) return null;
  const pool = data.sceneProfiles.filter(row => row.profileId === profileId);
  const weather = weatherId === 'any' ? pool : pool.filter(row => ['any', weatherId].includes(sceneMeta.get(row.sceneId).weatherId));
  const timed = (weather.length ? weather : pool).filter(row => sceneMeta.get(row.sceneId).timeId === timeId);
  const candidates = timed.length ? timed : weather.length ? weather : pool;
  if (!candidates.length) throw Error(`No compatible scene for ${profileId}`);
  let chosen = candidates.find(row => row.sceneId === savedSceneId);
  if (!chosen) {
    let ticket = hash(`${seedString}:${nodeId || profileId}:location-art`) / 4294967296 * candidates.reduce((sum,row)=>sum+row.weight,0);
    chosen = candidates.find(row => (ticket -= row.weight) < 0) || candidates.at(-1);
  }
  const meta = sceneMeta.get(chosen.sceneId);
  return { nodeId, profileId, sceneId:chosen.sceneId, settingId:profile.settingId, regionId:profile.regionId,
    requestedTimeId:timeId, timeId:meta.timeId, weatherId:meta.weatherId, timeFallback:meta.timeId!==timeId, weatherFallback:weatherId!=='any' && meta.weatherId!==weatherId,
    musicCandidates:data.musicProfiles.filter(row=>row.profileId===profileId).map(row=>({musicId:row.musicId,weight:row.weight})) };
}

export function presentationScene(selection) { return selection ? art.get(selection.sceneId) : null; }

const problems = presentationProblems();
if (problems.length) throw Error(`Location presentation: ${problems.join('; ')}`);
