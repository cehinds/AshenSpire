import { uiConfig } from '../config/generated/ui.js';
import { SEATS } from '../content/seats.js';
import { ATLAS } from './worldAtlas.js';

export const PROLOGUE_DEFAULTS = uiConfig.screens.prologue.components.sequence;
export const PROLOGUE_PREFIX = 'gameConfig.prologue.';
export const PROLOGUE_LAYOUT = uiConfig.screens.prologue;
const get = (object, path) => path.reduce((value, key) => value?.[key], object);
function put(object, path, value) {
  const parent = path.slice(0, -1).reduce((value, key) => value[key], object);
  parent[path.at(-1)] = value;
}

/** The version-1 scene order, kept verbatim so a saved index can be read. */
export const PROLOGUE_V1_SCENE_IDS = ['warmth', 'year', 'night', 'carry', 'road', 'step'];

/** The scene that was cut, and the one that followed it. */
export const PROLOGUE_CUT_SCENE_ID = 'road';
export const PROLOGUE_CUT_SCENE_HEIR = 'step';

/**
 * THE PAINTINGS A SCENE MAY DRAW ON, which is not the same list as the scenes.
 *
 * Art used to be the scene's own id and nothing else, so "play the road
 * painting under the last line" was impossible and `road`'s artwork — still
 * shipped in both asset trees — was unreachable after the scene was cut. A
 * scene now NAMES its background, defaulting to its own id, so the order of
 * scenes and the order of paintings are two separate decisions.
 */
export const PROLOGUE_ART_IDS = ['warmth', 'year', 'carry', 'night', 'step', 'road'];
const PROLOGUE_ART_LABELS = {
  warmth: 'Remembered warmth', year: 'The Burning', carry: 'What the fire left (per class)',
  night: 'Last night', step: 'The first step', road: 'The long road',
};

/** Which frame the scene is presented in. `caption` is the shipped one. */
export const PROLOGUE_LAYOUTS = {
  caption: 'Caption below the art',
  overlay: 'Text over the art',
  letterbox: 'Letterboxed art, text below',
  panelLeft: 'Text panel left, art right',
  panelRight: 'Art left, text panel right',
};

/** Where the text sits when the layout lets it float (overlay layouts). */
export const PROLOGUE_TEXT_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

/** Colours offered as swatches beside the wheel on every opening colour row. */
export const PROLOGUE_SWATCHES = Object.freeze([
  '#100e0c', '#1c1713', '#000000', '#eee6d5', '#ffffff',
  '#c9a227', '#c1453a', '#7fa8c9', '#8bae54', '#a06cc8', '#c9502e',
]);

/**
 * migratePrologueSettingKey(key) → the current name of a stored opening key.
 *
 * `gameConfig.prologue.scenes.<n>.<field>` is a version-1 key: `<n>` indexes the
 * SIX-scene order. It is unambiguous because current keys name their scene
 * (`scenes.carry.text`), never a number, so a digit there can only be old.
 */
export function migratePrologueSettingKey(key) {
  const match = new RegExp(`^${PROLOGUE_PREFIX.replace(/\./g, '\\.')}scenes\\.(\\d+)\\.(.+)$`).exec(key);
  if (!match) return key;
  const id = PROLOGUE_V1_SCENE_IDS[Number(match[1])];
  if (!id) return key;
  return `${PROLOGUE_PREFIX}scenes.${id === PROLOGUE_CUT_SCENE_ID ? PROLOGUE_CUT_SCENE_HEIR : id}.${match[2]}`;
}

/** The version-1 key a current one came from, or null when there is none. */
export function legacyPrologueSettingKey(key) {
  const match = new RegExp(`^${PROLOGUE_PREFIX.replace(/\./g, '\\.')}scenes\\.([a-z]+)\\.(.+)$`).exec(key);
  const index = match ? PROLOGUE_V1_SCENE_IDS.indexOf(match[1]) : -1;
  return index < 0 ? null : `${PROLOGUE_PREFIX}scenes.${index}.${match[2]}`;
}

const CUT_SCENE_PREFIX = `${PROLOGUE_PREFIX}scenes.${PROLOGUE_V1_SCENE_IDS.indexOf(PROLOGUE_CUT_SCENE_ID)}.`;

/**
 * migratePrologueEntries(entries) → the same [key, value] pairs under current
 * names, with the cut scene yielding to the scene that inherited its keys.
 *
 * `road` and `step` both land on `step`, so a file carrying both would have one
 * silently overwrite the other. `step`'s own value wins: it is the scene that
 * still exists, and the owner wrote that line against the scene it names.
 */
export function migratePrologueEntries(entries) {
  const claimed = new Set(entries.filter(([key]) => !key.startsWith(CUT_SCENE_PREFIX))
    .map(([key]) => migratePrologueSettingKey(key)));
  return entries
    .filter(([key]) => !key.startsWith(CUT_SCENE_PREFIX) || !claimed.has(migratePrologueSettingKey(key)))
    .map(([key, value]) => [migratePrologueSettingKey(key), value]);
}

/**
 * A scene setting is NAMED BY ITS SCENE, not by where the scene happens to sit.
 *
 * These keys live in the owner's exported configuration file and in his saved
 * profile, and they outlive any particular running order. `scenes.2.text` meant
 * `night` before the reorder and means `carry` after it, so a positional key
 * silently REATTACHES his writing to a different scene — and `scenes.5.text`,
 * whose scene was cut, stops resolving at all and takes the whole all-or-nothing
 * import down with it. The path into the config object stays positional (it
 * indexes an array); only the NAME is stable.
 */
export function prologueSettingKey(path) {
  if (path[0] !== 'scenes') return PROLOGUE_PREFIX + path.join('.');
  const id = PROLOGUE_DEFAULTS.scenes[Number(path[1])]?.id ?? path[1];
  return `${PROLOGUE_PREFIX}scenes.${id}.${path.slice(2).join('.')}`;
}

export function prologueRows() {
  const rows = [];
  const add = (path, label, topic, options = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Opening', prologueTopic: topic,
    key: prologueSettingKey(path), prologuePath: path,
    def: get(PROLOGUE_DEFAULTS, path), label,
    note: 'Saved with your configuration. Applies to previews and new openings.', ...options,
  });
  const number = (min, max, step = .1) => ({ type: 'number', min, max, step, integer: false });
  const whole = (min, max) => ({ type: 'number', min, max, step: 1, integer: true });
  const choice = (choices, choiceLabels) => ({ type: 'choice', choices, choiceLabels, dropdown: true });
  const text = (maxLength = 1000) => ({ type: 'textarea', maxLength });
  add(['presentation', 'playback'], 'Show opening', 'Playback', choice(['every','once','off'], {every:'Every new game',once:'First time per profile',off:'Off'}));
  add(['presentation', 'autoAdvance'], 'Advance scenes automatically', 'Playback');
  add(['presentation', 'transitionSeconds'], 'Transition time (seconds)', 'Playback', {...number(0,30),note:'Maximum fade length. Fits inside the scene duration, capped at one quarter so the artwork stays readable.'});
  add(['presentation', 'speed'], 'Playback speed', 'Playback', number(.25,3,.25));
  add(['presentation', 'reduceMotion'], 'Still artwork', 'Playback', {note:'Disables fades and camera movement. The accessibility Reduced motion setting is also respected.'});
  add(['presentation', 'tintSource'], 'Artwork tint follows', 'Motif', choice(['accent','character','custom'], {accent:'Interface accent',character:'Character tint',custom:'Custom colour'}));
  add(['presentation', 'customTint'], 'Custom artwork colour', 'Motif', {type:'color'});
  add(['presentation', 'wash'], 'Colour wash strength', 'Motif', number(0,.4,.01));
  add(['presentation', 'shadowStrength'], 'Character shadow strength', 'Motif', number(0,1,.05));
  add(['presentation', 'layout'], 'Scene wireframe', 'Stage', {...choice(Object.keys(PROLOGUE_LAYOUTS),PROLOGUE_LAYOUTS),note:'Which frame presents a scene: the caption under the art, text floating over it, a letterboxed plate, or a side panel.'});
  add(['presentation', 'imageScale'], 'Artwork scale', 'Stage', {...number(.5,3,.05),note:'Zooms the painting inside its frame. 1 fills the frame as shipped; larger crops in.'});
  add(['presentation', 'imageFit'], 'Artwork fit', 'Stage', choice(['cover','contain','fill'], {cover:'Fill the frame (crop)',contain:'Fit the whole painting',fill:'Stretch to the frame'}));
  add(['presentation', 'imageFocusX'], 'Artwork focus — horizontal (%)', 'Stage', {...whole(0,100),note:'Which part of the painting stays in frame when it is cropped. 50 is the centre.'});
  add(['presentation', 'imageFocusY'], 'Artwork focus — vertical (%)', 'Stage', {...whole(0,100),note:'0 keeps the top of the painting, 100 the bottom.'});
  add(['presentation', 'bannerPosition'], 'Banner position', 'Stage', choice(['top','bottom'], {top:'Across the top',bottom:'Across the bottom'}));
  add(['presentation', 'textPosition'], 'Text position', 'Text', {...choice(PROLOGUE_TEXT_POSITIONS,Object.fromEntries(PROLOGUE_TEXT_POSITIONS.map(id=>[id,id.split('-').map((word,index)=>index?word:word[0].toUpperCase()+word.slice(1)).join(' ')]))),note:'Where the words sit. Floating positions need a wireframe that puts text over the art.'});
  add(['presentation', 'textAlign'], 'Text alignment', 'Text', choice(['left','center','right'], {left:'Left',center:'Centred',right:'Right'}));
  add(['presentation', 'textScale'], 'Text size', 'Text', {...number(.6,2,.05),note:'Multiplies every line in the caption, title and speaker together.'});
  add(['presentation', 'textBox'], 'Text sits in a container', 'Text', {note:'Off lets the words lie directly on the artwork.'});
  add(['presentation', 'textBoxVisible'], 'Container is visible', 'Text', {note:'Off keeps the container’s spacing but draws nothing behind the words.'});
  add(['presentation', 'textBoxOpacity'], 'Container opacity', 'Text', number(0,1,.01));
  add(['presentation', 'textBoxColor'], 'Container colour', 'Text', {type:'colorSwatch',swatches:PROLOGUE_SWATCHES});
  add(['presentation', 'textOutline'], 'Outline the text', 'Text', {note:'Draws a contrasting edge around every letter so words stay legible over bright artwork.'});
  add(['presentation', 'textOutlineColor'], 'Outline colour', 'Text', {type:'colorSwatch',swatches:PROLOGUE_SWATCHES});
  add(['presentation', 'textOutlineWidth'], 'Outline thickness (px)', 'Text', number(0,8,.5));
  for (const [index, scene] of PROLOGUE_DEFAULTS.scenes.entries()) {
    const path = ['scenes', String(index)];
    add([...path,'name'], 'Scene title', scene.name, text(160));
    add([...path,'enabled'], 'Play this scene', scene.name, {note:'Off shortens the opening by one scene. The opening always keeps at least one.'});
    add([...path,'order'], 'Position in the opening', scene.name, {...whole(1,PROLOGUE_DEFAULTS.scenes.length),note:'Scenes play in this order, lowest first. Ties keep their authored order.'});
    add([...path,'art'], 'Scene artwork', scene.name, {...choice(PROLOGUE_ART_IDS,PROLOGUE_ART_LABELS),note:'Which painting plays under this scene. Any scene may borrow another scene’s art.'});
    add([...path,'banner'], 'Show a title banner', scene.name, {note:'Draws the scene title as a banner across the artwork.'});
    add([...path,'speaker'], 'Speaker', scene.name, {...text(160),note:'Use {name} for the player or {class} for their class.'});
    add([...path,'text'], 'Dialogue', scene.name, {...text(5000),note:'Editable narration; line breaks are preserved. {classLine} uses the selected class’s line.'});
    add([...path,'seconds'], 'Scene duration (seconds)', scene.name, {...number(1,180),note:'Total scene time, including its transition. Default: 5 seconds. The final scene waits for Set forth.'});
    add([...path,'effect'], 'Transition effect', scene.name, choice(['fade','dip','push','ash','still'], {fade:'Crossfade',dip:'Fade through black',push:'Slow push',ash:'Ash reveal',still:'Still'}));
    if ('location' in scene) add([...path,'location'], 'Location caption', scene.name, {...text(160),note:'Use {location} to show the actual starting destination.'});
    if (scene.actor) for (const layout of ['desktop','mobile']) for (const axis of ['x','y','height']) {
      add([...path,'actor',layout,axis], `${layout === 'mobile' ? 'Mobile' : 'Desktop'} traveller ${axis === 'height' ? 'height' : axis === 'x' ? 'horizontal position' : 'foot position'} (%)`, scene.name, number(axis === 'height' ? 10 : 0,100,1));
    }
  }
  for (const [id, cls] of Object.entries(PROLOGUE_DEFAULTS.classes)) add(['classes',id,'line'], `${cls.name} dialogue`, 'Class dialogue', text(5000));
  for (const key of Object.keys(PROLOGUE_DEFAULTS.labels)) add(['labels',key], `${PROLOGUE_DEFAULTS.labels[key]} button text`, 'Button text', text(160));
  add(['presentation','previewClass'], 'Preview class', 'Preview', choice(Object.keys(PROLOGUE_DEFAULTS.classes),Object.fromEntries(Object.entries(PROLOGUE_DEFAULTS.classes).map(([id,cls])=>[id,cls.name]))));
  // `road` was cut. A configuration that points the preview at it opens on the
  // scene that followed it rather than refusing the entire file.
  add(['presentation','previewScene'], 'Preview starting scene', 'Preview', {...choice(PROLOGUE_DEFAULTS.scenes.map(s=>s.id),Object.fromEntries(PROLOGUE_DEFAULTS.scenes.map(s=>[s.id,s.name]))), legacyChoices:{[PROLOGUE_CUT_SCENE_ID]:PROLOGUE_CUT_SCENE_HEIR}});
  rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Preview',type:'button',key:'prologuePreview',label:'Preview opening',btn:'Play preview',note:'Uses these settings without creating a run or marking the opening seen.'});
  // THE SCENE FILE IS A VIEW OF THE SAME KEYS, NOT A SECOND STORE. Export
  // writes the opening exactly as the art studio's preset is shaped, and the
  // ordinary configuration import already accepts that shape — so an opening
  // travels on its own, and travels inside a whole-game export as well,
  // without either file learning a format the other does not read.
  rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Scene file',type:'button',key:'prologueSceneExport',label:'Export scene configuration',btn:'Export JSON',note:'Writes every opening setting — order, artwork, wireframe, text — to one file. These settings also travel inside the whole game configuration export.'});
  rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Scene file',type:'button',key:'prologueSceneImport',label:'Load scene configuration',btn:'Load JSON',note:'Reads a scene file, or an art-studio preset. Nothing is applied unless the whole file is valid.'});
  return rows;
}

export function prologueConfig(settings = {}) {
  const config = structuredClone(PROLOGUE_DEFAULTS);
  for (const row of prologueRows()) {
    // A profile written before the reorder still holds positional keys; read
    // them under the name they meant then (see migratePrologueSettingKey).
    const legacy = legacyPrologueSettingKey(row.key);
    const value = settings[row.key] ?? (legacy === null ? undefined : settings[legacy]);
    if (value === undefined || !row.prologuePath) continue;
    const valid = row.type === 'choice' ? row.choices.includes(value)
      : ['color', 'colorSwatch'].includes(row.type) ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      : row.type === 'textarea' ? typeof value === 'string' && value.length <= row.maxLength
      : row.type === 'number' ? typeof value === 'number' && Number.isFinite(value) && value >= row.min && value <= row.max && (!row.integer || Number.isInteger(value))
      : typeof value === 'boolean';
    if (valid) put(config,row.prologuePath,value);
  }
  return config;
}

/**
 * prologueSequence(config) → the scene indices to play, in playing order.
 *
 * The indices are into `config.scenes`, which stays in AUTHORED order forever:
 * a saved run records where it stopped as one of these numbers, and a reorder
 * must not move a paused run to a different scene. Order and inclusion are
 * settings laid over that fixed list, so the opening can be resequenced and
 * shortened while `run.prologue.scene` keeps meaning what it meant.
 *
 * AN OPENING IS NEVER EMPTY. Switching every scene off would otherwise give a
 * sequence with no scene to show and no button to leave it with, so the
 * authored order stands in.
 */
export function prologueSequence(config) {
  const kept = config.scenes.filter((scene) => scene.enabled !== false);
  // AUTHORED ORDER MEANS AUTHORED ORDER. Falling back through the same sort
  // returned whatever positions had been typed — the shipped opening in a
  // running order nobody chose to watch, since every scene in it is switched
  // off. The stand-in is the sequence as shipped, and it is returned before the
  // order is consulted at all.
  if (!kept.length) return config.scenes.map((scene, index) => index);
  return stagedOrder(config).filter((index) => config.scenes[index].enabled !== false);
}

/** Every scene, in the order they WOULD play — the staging before inclusion. */
function stagedOrder(config) {
  return config.scenes
    .map((scene, index) => ({ index, at: Number.isFinite(scene.order) ? scene.order : index + 1 }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.index);
}

/**
 * prologueResumePosition(config, sceneIndex) → where in the sequence to restart.
 *
 * A RUN PAUSED ON A SCENE THAT IS NO LONGER IN THE OPENING MUST NOT REPLAY IT
 * ALL. The first cut of this searched the playing order for an authored index
 * at or after the saved one and took `Math.max(0, …)` of the answer — so a
 * missing scene (findIndex → -1) sent the run back to the FIRST scene, which is
 * the one thing the comment above it promised would not happen, and comparing
 * authored indices against a resequenced order was not a "what comes next" test
 * in the first place.
 *
 * The question is asked in the staging instead: walk forward from where the
 * saved scene sits in the full running order to the first scene still switched
 * on. Past the end, the LAST scene stands — a run parked near the finish is not
 * sent back through scenes it has already watched.
 */
export function prologueResumePosition(config, sceneIndex) {
  const order = prologueSequence(config);
  const at = order.indexOf(sceneIndex);
  if (at >= 0) return at;
  const staged = stagedOrder(config);
  const from = staged.indexOf(sceneIndex);
  if (from < 0) return 0;
  for (let step = from + 1; step < staged.length; step += 1) {
    const found = order.indexOf(staged[step]);
    if (found >= 0) return found;
  }
  return Math.max(0, order.length - 1);
}

/**
 * prologueBoxBackground(presentation) → the container's CSS background.
 *
 * THE SHIPPED STRIP IS A GRADIENT, and a container that replaced it with a flat
 * colour changed how the opening looks for every profile that had never opened
 * these settings — while the comment beside it claimed the opposite. The
 * container keeps the gradient and builds it FROM the chosen colour: the colour
 * itself at the bottom, lifted by the same amount the authored strip was lifted
 * by at the top. At the shipped colour and opacity this is exactly the strip
 * that shipped (#19150f → #100e0c); at any other colour it is that strip's
 * shape in the owner's colour.
 */
const PROLOGUE_BOX_LIFT = [9, 7, 3];
export function prologueBoxBackground(presentation = {}) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(presentation.textBoxColor || ''));
  const base = match ? match.slice(1).map((part) => parseInt(part, 16)) : [16, 14, 12];
  const alpha = Number.isFinite(presentation.textBoxOpacity) ? Math.min(1, Math.max(0, presentation.textBoxOpacity)) : 1;
  const rgba = (channels) => `rgba(${channels.join(',')},${alpha})`;
  const lifted = base.map((channel, index) => Math.min(255, channel + PROLOGUE_BOX_LIFT[index]));
  return `linear-gradient(${rgba(lifted)},${rgba(base)})`;
}

/** The painting a scene draws on: its own by default, any shipped one by setting. */
export function prologueSceneArt(scene) {
  return PROLOGUE_ART_IDS.includes(scene?.art) ? scene.art : scene?.id;
}

/**
 * prologueScenePreset(settings) → the opening alone, as a file.
 *
 * Deliberately the SAME shape the art studio already exports and
 * `prologuePresetOverrides` already reads, so one importer serves both and a
 * scene file dropped into Load game configuration works without a second path.
 */
export function prologueScenePreset(settings = {}) {
  return `${JSON.stringify(prologueConfig(settings), null, 2)}\n`;
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

// Resolve the real destination NAME without drawing gameplay RNG or assigning a
// class a region. It used to resolve a painting too; the final scene no longer
// swaps its artwork for the destination's, and nothing in src/ read `art` — the
// only thing keeping it alive was a test asserting it. A branch whose sole
// consumer is its own test is not a feature, it is a claim about behaviour that
// does not happen.
export function prologueDestination(run = {}) {
  const start = run.journey?.anchors?.start;
  if (start) return {name: ATLAS.nodes[start]?.displayName || start};
  return {name: SEATS.find(s=>s.id===run.seatOrder?.[0])?.name || 'Crownfall'};
}

export function shouldPlayPrologue(settings = {}, seen = false) {
  const mode = prologueConfig(settings).presentation.playback;
  return mode === 'every' || (mode === 'once' && !seen);
}

/**
 * The stored shape of `run.prologue`. Version 1 held an index into the SIX-scene
 * opening; version 2 holds an index into whatever `PROLOGUE_DEFAULTS.scenes` is
 * now. The number is only meaningful next to the order it was written against,
 * so the order it was written against has to be recorded.
 */
export const PROLOGUE_STATE_VERSION = 2;

/**
 * migratePrologueState(run) → the same run, with a version-1 opening state
 * rewritten to version 2. Idempotent, and silent for runs with no opening.
 *
 * BY SCENE ID, NOT BY ARITHMETIC. `night` and `carry` swapped places and `road`
 * was cut, so no offset describes the move: 2 → 3, 3 → 2, 5 → 4. A save parked
 * on the old final scene (5) failed the bounds check of the five-scene sequence,
 * `pendingPrologueScene` answered null, and the loader fell through to the map —
 * the opening skipped on every load while `status` stayed 'pending' forever.
 *
 * `road` no longer exists. A run stopped there had not yet seen what followed
 * it, so it resumes at the scene that DID follow it ('step'), rather than being
 * sent back through scenes it has already watched.
 */
export function migratePrologueState(run) {
  const state = run?.prologue;
  if (!state || state.version !== 1) return run;
  const position = id => PROLOGUE_DEFAULTS.scenes.findIndex(scene => scene.id === id);
  const from = Number.isInteger(state.scene) ? state.scene : 0;
  let scene = -1;
  // Walk forward from the recorded scene: the first old scene still in the
  // sequence is the earliest one this run has not finished.
  for (let index = Math.max(0, Math.min(from, PROLOGUE_V1_SCENE_IDS.length - 1)); index < PROLOGUE_V1_SCENE_IDS.length && scene < 0; index += 1) {
    scene = position(PROLOGUE_V1_SCENE_IDS[index]);
  }
  run.prologue = { ...state, version: PROLOGUE_STATE_VERSION, scene: scene < 0 ? PROLOGUE_DEFAULTS.scenes.length - 1 : scene };
  return run;
}

export function pendingPrologueScene(run) {
  const state = run?.prologue;
  return state?.version === PROLOGUE_STATE_VERSION && state.status === 'pending' && Number.isInteger(state.scene)
    && state.scene >= 0 && state.scene < PROLOGUE_DEFAULTS.scenes.length ? state.scene : null;
}
