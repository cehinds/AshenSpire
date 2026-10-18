import { LAYERED_SCENES, INTRO_LAYERED_SCENES, LAYERED_TIME_FILTERS, LAYERED_WEATHER_FILTERS } from '../content/layeredEnvironments.js';
import { locationPresentation } from '../content/generated/locationPresentation.js';
import { combatEnvironment } from './environmentArt.js';

const nodeProfiles = new Map(locationPresentation.nodeProfiles.map(row => [row.nodeId, row.profileId]));
const REGION_SETTINGS = {
  'ashen-crown': { road: 'open-road', city: 'city-street', town: 'city-street', castle: 'castle-grounds', dungeon: 'dungeon-corridor' },
  'hollow-weald': { road: 'forest-path', forest: 'forest-path', city: 'village-lane', town: 'village-lane' },
  'pale-marches': { city: 'snowy-street', town: 'snowy-street', street: 'snowy-street' },
  'cinder-reach': { castle: 'volcanic-castle-exterior', tower: 'cinder-tower' },
};

// Art selection reads presentation inputs only. It neither consumes gameplay
// randomness nor stores scene IDs in the run's existing atlas selection.
export function layeredCombatScene(run = {}, environment) {
  const nodeId = run.journey?.currentNodeId || run.mapNodeId || run.cursorId;
  const node = run.mapGraph?.nodes?.[nodeId]
    || (Array.isArray(run.map?.nodes) ? run.map.nodes.find(candidate => candidate.id === nodeId) : undefined);
  // Co-op projects its graph as an array and names the current point cursorId.
  // Adapt that read-only view for the same seat/final-causeway rules as solo.
  if (!run.journey && !run.mapNodeId && run.cursorId && node) {
    environment = combatEnvironment({ ...run, mapNodeId: nodeId, mapGraph: { nodes: { [nodeId]: node } } });
  }
  const binding = INTRO_LAYERED_SCENES[nodeId];
  let sceneId = typeof binding === 'string' ? binding : binding?.sceneId;
  if (!sceneId && node?.layeredSceneId) sceneId = node.layeredSceneId;
  if (!sceneId) {
    const profile = nodeProfiles.get(nodeId);
    const [authoredRegion, authoredSetting] = profile?.split('/') || [];
    const regionId = authoredRegion || run.environmentRegionId || environment?.region?.id;
    const taggedSetting = Array.isArray(node?.tags) ? node.tags.find(tag => REGION_SETTINGS[regionId]?.[tag]) : null;
    const typeSetting = node?.type === 'boss' ? 'dungeon' : node?.type === 'merchant' ? 'city'
      : ['fight', 'elite', 'monster'].includes(node?.type) ? 'road' : null;
    const setting = authoredSetting || node?.settingId || taggedSetting || typeSetting;
    sceneId = REGION_SETTINGS[regionId]?.[setting];
  }
  let scene = LAYERED_SCENES[sceneId];
  if (!scene) return null;
  const explicitTime = ['day', 'dusk', 'night'].includes(run.presentationTimeId);
  const timeId = explicitTime ? run.presentationTimeId : scene.condition === 'night' ? 'night' : 'day';
  const requestedWeather = run.presentationWeatherId;
  const weatherId = scene.interior ? 'clear'
    : ['clear', 'rain', 'snow', 'ash'].includes(requestedWeather) ? requestedWeather
      : scene.condition === 'rain' ? 'rain' : 'clear';
  // The city has a painted night backdrop. Other scenes use the authored tint.
  if (['city-street', 'city-street-night', 'city-street-rain'].includes(scene.id)) {
    const variant = timeId === 'night' ? 'city-street-night' : weatherId === 'rain' ? 'city-street-rain' : 'city-street';
    scene = LAYERED_SCENES[variant] || scene;
  }
  const layers = scene.layers.filter(layer =>
    (layer.purpose !== 'time-of-day' || (scene.interior && !explicitTime))
    && layer.purpose !== 'weather' && layer.role !== 'particles');
  const additional = typeof binding === 'object' ? binding.additionalProps || [] : [];
  const groundIndex = layers.findIndex(layer => layer.role === 'ground');
  layers.splice(groundIndex < 0 ? layers.length : groundIndex, 0, ...additional);
  const timeFilter = LAYERED_TIME_FILTERS[timeId === 'night' ? 'night' : 'day'];
  if (timeFilter && (!scene.interior || explicitTime)) layers.push(timeFilter);
  const weather = LAYERED_WEATHER_FILTERS[weatherId];
  if (!scene.interior && weather) layers.push(...(Array.isArray(weather) ? weather : [weather]));
  return { ...scene, timeId, weatherId, layers };
}
