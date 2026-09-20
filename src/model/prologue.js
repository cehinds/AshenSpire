import { uiConfig } from '../config/generated/ui.js';
import { SEATS } from '../content/seats.js';
import { ENVIRONMENTS } from '../content/environments.js';
import { ATLAS } from './worldAtlas.js';

export const PROLOGUE_DEFAULTS = uiConfig.screens.prologue.components.sequence;
export const PROLOGUE_PREFIX = 'gameConfig.prologue.';
export const PROLOGUE_LAYOUT = uiConfig.screens.prologue;
const get = (object, path) => path.reduce((value, key) => value?.[key], object);
function put(object, path, value) {
  const parent = path.slice(0, -1).reduce((value, key) => value[key], object);
  parent[path.at(-1)] = value;
}

export function prologueRows() {
  const rows = [];
  const add = (path, label, topic, options = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Opening', prologueTopic: topic,
    key: PROLOGUE_PREFIX + path.join('.'), prologuePath: path,
    def: get(PROLOGUE_DEFAULTS, path), label,
    note: 'Saved with your configuration. Applies to previews and new openings.', ...options,
  });
  const number = (min, max, step = .1) => ({ type: 'number', min, max, step, integer: false });
  const choice = (choices, choiceLabels) => ({ type: 'choice', choices, choiceLabels, dropdown: true });
  const text = (maxLength = 1000) => ({ type: 'textarea', maxLength });
  add(['presentation', 'playback'], 'Show opening', 'Playback', choice(['every','once','off'], {every:'Every new game',once:'First time per profile',off:'Off'}));
  add(['presentation', 'autoAdvance'], 'Advance scenes automatically', 'Playback');
  add(['presentation', 'transitionSeconds'], 'Transition time (seconds)', 'Playback', number(0,30));
  add(['presentation', 'speed'], 'Playback speed', 'Playback', number(.25,3,.25));
  add(['presentation', 'reduceMotion'], 'Still artwork', 'Playback', {note:'Disables fades and camera movement. The accessibility Reduced motion setting is also respected.'});
  add(['presentation', 'tintSource'], 'Artwork tint follows', 'Motif', choice(['accent','character','custom'], {accent:'Interface accent',character:'Character tint',custom:'Custom colour'}));
  add(['presentation', 'customTint'], 'Custom artwork colour', 'Motif', {type:'color'});
  add(['presentation', 'wash'], 'Colour wash strength', 'Motif', number(0,.4,.01));
  for (const [index, scene] of PROLOGUE_DEFAULTS.scenes.entries()) {
    const path = ['scenes', String(index)];
    add([...path,'name'], 'Scene title', scene.name, text(160));
    add([...path,'speaker'], 'Speaker', scene.name, {...text(160),note:'Use {name} for the player or {class} for their class.'});
    add([...path,'text'], 'Dialogue', scene.name, {...text(5000),note:'Editable narration; line breaks are preserved. {classLine} uses the selected class’s line.'});
    add([...path,'seconds'], 'Hold time (seconds)', scene.name, number(1,180));
    add([...path,'effect'], 'Transition effect', scene.name, choice(['fade','dip','push','ash','still'], {fade:'Crossfade',dip:'Fade through black',push:'Slow push',ash:'Ash reveal',still:'Still'}));
    if ('location' in scene) add([...path,'location'], 'Location caption', scene.name, {...text(160),note:'Use {location} to show the actual starting destination.'});
    if (scene.actor) for (const layout of ['desktop','mobile']) for (const axis of ['x','y','height']) {
      add([...path,'actor',layout,axis], `${layout === 'mobile' ? 'Mobile' : 'Desktop'} traveller ${axis === 'height' ? 'height' : axis === 'x' ? 'horizontal position' : 'foot position'} (%)`, scene.name, number(axis === 'height' ? 10 : 0,100,1));
    }
  }
  for (const [id, cls] of Object.entries(PROLOGUE_DEFAULTS.classes)) add(['classes',id,'line'], `${cls.name} dialogue`, 'Class dialogue', text(5000));
  for (const key of Object.keys(PROLOGUE_DEFAULTS.labels)) add(['labels',key], `${PROLOGUE_DEFAULTS.labels[key]} button text`, 'Button text', text(160));
  add(['presentation','previewClass'], 'Preview class', 'Preview', choice(Object.keys(PROLOGUE_DEFAULTS.classes),Object.fromEntries(Object.entries(PROLOGUE_DEFAULTS.classes).map(([id,cls])=>[id,cls.name]))));
  add(['presentation','previewScene'], 'Preview starting scene', 'Preview', choice(PROLOGUE_DEFAULTS.scenes.map(s=>s.id),Object.fromEntries(PROLOGUE_DEFAULTS.scenes.map(s=>[s.id,s.name]))));
  rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Preview',type:'button',key:'prologuePreview',label:'Preview opening',btn:'Play preview',note:'Uses these settings without creating a run or marking the opening seen.'});
  return rows;
}

export function prologueConfig(settings = {}) {
  const config = structuredClone(PROLOGUE_DEFAULTS);
  for (const row of prologueRows()) {
    const value = settings[row.key];
    if (value === undefined || !row.prologuePath) continue;
    const valid = row.type === 'choice' ? row.choices.includes(value)
      : row.type === 'color' ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      : row.type === 'textarea' ? typeof value === 'string' && value.length <= row.maxLength
      : row.type === 'number' ? typeof value === 'number' && Number.isFinite(value) && value >= row.min && value <= row.max
      : typeof value === 'boolean';
    if (valid) put(config,row.prologuePath,value);
  }
  return config;
}

/** Bridge the original art-studio exports into ordinary game settings. */
export function prologuePresetOverrides(preset) {
  if (preset?.schemaVersion !== 1 || preset.kind !== 'AshenSpire prologue art'
    || !Array.isArray(preset.scenes) || preset.scenes.length !== PROLOGUE_DEFAULTS.scenes.length
    || new Set(preset.scenes.map(s=>s?.id)).size !== preset.scenes.length) throw new Error('Invalid opening preset. Nothing was imported.');
  const source = {...preset, scenes:PROLOGUE_DEFAULTS.scenes.map(scene=>preset.scenes.find(s=>s?.id===scene.id))};
  if (source.scenes.some(s=>!s)) throw new Error('Opening preset has an unknown scene. Nothing was imported.');
  const changes = {};
  for (const row of prologueRows()) {
    if (!row.prologuePath) continue;
    const value = get(source,row.prologuePath);
    if (value !== undefined) changes[row.key] = value;
  }
  return changes;
}

export function prologueCopy(scene, config, {classId = 'reaver', name = 'Forsaken', location = 'Crownfall'} = {}) {
  const cls = config.classes[classId] || config.classes.reaver;
  const tokens = {name,location,class:cls.name,classLine:cls.line};
  const resolve = value => String(value || '').replace(/\{(name|location|class|classLine)\}/g,(_,key)=>tokens[key]);
  return {title:scene.name,speaker:resolve(scene.speaker),text:resolve(scene.text),location:resolve(scene.location)};
}

export function prologueTint(config, settings = {}, customization = {}) {
  const p = config.presentation;
  const accent = config.palettes.accent[settings.accent] || config.palettes.accent.gold;
  if (p.tintSource === 'custom') return p.customTint;
  if (p.tintSource === 'character' && customization.tint !== 'gold') return config.palettes.character[customization.tint] || accent;
  return accent;
}

// Resolve the real destination without drawing gameplay RNG or assigning a class a region.
export function prologueDestination(run = {}) {
  const start = run.journey?.anchors?.start;
  if (start) {
    const node = ATLAS.nodes[start];
    return {name:node?.displayName || start, art:start === 'crownfall' ? null : ATLAS.assets[node?.landmarkAssetId]?.uri};
  }
  const seat = SEATS.find(s=>s.id===run.seatOrder?.[0]);
  const region = ENVIRONMENTS.find(r=>r.id===seat?.regionId);
  return {name:seat?.name || 'Crownfall', art:region?.map || null};
}

export function shouldPlayPrologue(settings = {}, seen = false) {
  const mode = prologueConfig(settings).presentation.playback;
  return mode === 'every' || (mode === 'once' && !seen);
}

export function pendingPrologueScene(run) {
  const state = run?.prologue;
  return state?.version === 1 && state.status === 'pending' && Number.isInteger(state.scene)
    && state.scene >= 0 && state.scene < PROLOGUE_DEFAULTS.scenes.length ? state.scene : null;
}
