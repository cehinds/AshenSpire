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
  none: 'No painting (text only)',
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

/** `none` is a scene with no painting at all — a text card on the backdrop. */
export const PROLOGUE_ART_CHOICES = ['none', ...PROLOGUE_ART_IDS];

/** Where the camera drifts while a scene holds. `auto` keeps the old rule. */
export const PROLOGUE_CAMERA = {
  auto: 'Follow the transition (slow push zooms in)',
  none: 'Held still',
  in: 'Push in', out: 'Pull out',
  left: 'Drift left', right: 'Drift right', up: 'Drift up', down: 'Drift down',
};

/** How the words arrive. */
export const PROLOGUE_REVEALS = {
  none: 'All at once',
  typewriter: 'Letter by letter',
  lines: 'Line by line',
};

/** The music beds a scene may call for, beyond keeping what is playing. */
export const PROLOGUE_MUSIC = {
  keep: 'Keep what is playing',
  // `quiet` is a real music context whose bed is the silence word, not the
  // absence of one: switching to it leaves the engine knowing where it is, so
  // the screen after the opening starts its own bed again.
  quiet: 'Silence',
  title: 'Title', map: 'The road', rest: 'Shrine', shop: 'Merchant',
  combat: 'Combat', elite: 'Elite', boss: 'Boss', victory: 'Victory',
};

/** One-shot sounds a scene may open on. */
export const PROLOGUE_STINGERS = {
  none: 'None', beat: 'Low beat', stagger: 'Stagger', relic: 'Relic',
  shrine: 'Shrine', nodeTravel: 'Footfall', enemyDeath: 'Fall', victory: 'Victory',
};

/** The slots an added scene lands in, and the preset slots a whole opening does. */
export const PROLOGUE_SLOT_IDS = Object.freeze(PROLOGUE_DEFAULTS.scenes.slice(-PROLOGUE_DEFAULTS.slots).map((scene) => scene.id));
export const PROLOGUE_PRESET_IDS = Object.freeze(Object.keys(PROLOGUE_DEFAULTS.presets));

/**
 * THE STAGING, ONE TABLE, TWO HOMES.
 *
 * Every field here exists twice: once under `presentation`, where it is the
 * opening's house style, and once under each scene's `stage`, where it is that
 * scene's own answer — read only when the scene says `ownStaging`. The table is
 * what keeps the two in step: the rows, the defaults, the validation and the
 * resolution all read it, so a field cannot be added to one home and forgotten
 * in the other.
 */
export const PROLOGUE_STAGE_FIELDS = Object.freeze([
  { key: 'layout', topic: 'Stage', label: 'Scene wireframe', type: 'choice', choices: PROLOGUE_LAYOUTS,
    note: 'Which frame presents a scene: the caption under the art, text floating over it, a letterboxed plate, or a side panel.' },
  { key: 'imageScale', topic: 'Stage', label: 'Artwork scale', min: .5, max: 3, step: .05,
    note: 'Zooms the painting inside its frame. 1 fills the frame as shipped; larger crops in.' },
  { key: 'imageFit', topic: 'Stage', label: 'Artwork fit', type: 'choice',
    choices: { cover: 'Fill the frame (crop)', contain: 'Fit the whole painting', fill: 'Stretch to the frame' } },
  { key: 'imageFocusX', topic: 'Stage', label: 'Artwork focus — horizontal (%)', min: 0, max: 100, integer: true,
    note: 'Which part of the painting stays in frame when it is cropped. 50 is the centre.' },
  { key: 'imageFocusY', topic: 'Stage', label: 'Artwork focus — vertical (%)', min: 0, max: 100, integer: true,
    note: '0 keeps the top of the painting, 100 the bottom.' },
  { key: 'camera', topic: 'Stage', label: 'Camera movement', type: 'choice', choices: PROLOGUE_CAMERA,
    note: 'The drift while a scene holds. Follow the transition keeps the original rule: a slow push zooms in, everything else is still.' },
  { key: 'cameraAmount', topic: 'Stage', label: 'Camera distance (%)', min: 0, max: 20, step: .5,
    note: 'How far the camera travels across the whole scene. 3.5 is the shipped push.' },
  { key: 'wash', topic: 'Stage', label: 'Colour wash strength', min: 0, max: .4, step: .01,
    note: 'How much of the motif colour lies over the painting. A dark plate wants less.' },
  { key: 'textPosition', topic: 'Text', label: 'Text position', type: 'choice',
    choices: Object.fromEntries(PROLOGUE_TEXT_POSITIONS.map((id) => [id, id.split('-').map((word, index) => (index ? word : word[0].toUpperCase() + word.slice(1))).join(' ')])),
    note: 'Where the words sit. Floating positions need a wireframe that puts text over the art.' },
  { key: 'textAlign', topic: 'Text', label: 'Text alignment', type: 'choice', choices: { left: 'Left', center: 'Centred', right: 'Right' } },
  { key: 'textScale', topic: 'Text', label: 'Text size', min: .6, max: 2, step: .05,
    note: 'Multiplies every line in the caption, title and speaker together.' },
  { key: 'textInsetX', topic: 'Text', label: 'Text inset — sides (%)', min: 0, max: 40, step: .5,
    note: 'Keeps floating text clear of the frame’s edges, so it can dodge what the painting puts there.' },
  { key: 'textInsetY', topic: 'Text', label: 'Text inset — top and bottom (%)', min: 0, max: 40, step: .5 },
  { key: 'textBox', topic: 'Text', label: 'Text sits in a container', note: 'Off lets the words lie directly on the artwork.' },
  { key: 'textBoxVisible', topic: 'Text', label: 'Container is visible', note: 'Off keeps the container’s spacing but draws nothing behind the words.' },
  { key: 'textBoxOpacity', topic: 'Text', label: 'Container opacity', min: 0, max: 1, step: .01 },
  { key: 'textBoxColor', topic: 'Text', label: 'Container colour', type: 'colorSwatch' },
  { key: 'textOutline', topic: 'Text', label: 'Outline the text',
    note: 'Draws a contrasting edge around every letter so words stay legible over bright artwork.' },
  { key: 'textOutlineColor', topic: 'Text', label: 'Outline colour', type: 'colorSwatch' },
  { key: 'textOutlineWidth', topic: 'Text', label: 'Outline thickness (px)', min: 0, max: 8, step: .5 },
  { key: 'reveal', topic: 'Text', label: 'Text reveal', type: 'choice', choices: PROLOGUE_REVEALS,
    note: 'Whether the narration arrives whole, letter by letter, or a line at a time. Reduced motion always shows it whole.' },
  { key: 'revealSpeed', topic: 'Text', label: 'Reveal speed', min: 5, max: 200, step: 5, integer: true,
    note: 'Letters per second, or lines per ten seconds when revealing by line.' },
  { key: 'textDelaySeconds', topic: 'Text', label: 'Text waits (seconds)', min: 0, max: 20, step: .5,
    note: 'Hold the artwork alone before the words arrive.' },
  // ---- the artwork itself, as a picture ------------------------------------
  { key: 'imageBrightness', topic: 'Stage', label: 'Artwork brightness', min: .2, max: 2, step: .05 },
  { key: 'imageContrast', topic: 'Stage', label: 'Artwork contrast', min: .2, max: 2, step: .05 },
  { key: 'imageSaturation', topic: 'Stage', label: 'Artwork colour', min: 0, max: 2, step: .05,
    note: '0 is grey. This is the painting itself, before the motif wash goes over it.' },
  { key: 'imageBlur', topic: 'Stage', label: 'Artwork blur (px)', min: 0, max: 20, step: .5,
    note: 'Softens the painting — useful under a text card, or to push a scene out of focus.' },
  { key: 'imageFlip', topic: 'Stage', label: 'Mirror the artwork',
    note: 'Flips the painting left to right, so a figure can face the other way.' },
  { key: 'vignette', topic: 'Stage', label: 'Vignette strength', min: 0, max: 1, step: .05,
    note: 'Darkens the frame’s edges. Holds the eye on the middle and helps text at an edge.' },
  { key: 'backdropColor', topic: 'Stage', label: 'Backdrop colour', type: 'colorSwatch',
    note: 'What lies behind the painting — the whole frame for a scene with no artwork.' },
  { key: 'letterboxColor', topic: 'Stage', label: 'Letterbox bar colour', type: 'colorSwatch',
    note: 'The bars either side of a letterboxed plate.' },
  { key: 'transitionSeconds', topic: 'Stage', label: 'Transition time (seconds)', min: 0, max: 30, step: .1,
    note: 'Maximum fade length. Fits inside the scene duration, capped at one quarter so the artwork stays readable.' },
  { key: 'transitionEase', topic: 'Stage', label: 'Transition easing', type: 'choice',
    choices: { 'ease-in-out': 'Ease in and out', linear: 'Even', ease: 'Ease', 'ease-in': 'Ease in', 'ease-out': 'Ease out' } },
  { key: 'cameraEase', topic: 'Stage', label: 'Camera easing', type: 'choice',
    choices: { linear: 'Even', 'ease-in-out': 'Ease in and out', 'ease-out': 'Settle at the end', 'ease-in': 'Start slowly' } },
  // ---- the words, part by part ---------------------------------------------
  { key: 'titleVisible', topic: 'Text', label: 'Show the scene title' },
  { key: 'speakerVisible', topic: 'Text', label: 'Show the speaker' },
  { key: 'locationVisible', topic: 'Text', label: 'Show the location caption' },
  { key: 'progressStyle', topic: 'Text', label: 'Scene counter', type: 'choice',
    choices: { numbers: 'Numbers (3 / 5)', dots: 'Dots', hidden: 'Hidden' } },
  { key: 'titleColor', topic: 'Text', label: 'Title colour', type: 'colorSwatch' },
  { key: 'speakerColor', topic: 'Text', label: 'Speaker colour', type: 'colorSwatch' },
  { key: 'dialogueColor', topic: 'Text', label: 'Narration colour', type: 'colorSwatch' },
  { key: 'locationColor', topic: 'Text', label: 'Location colour', type: 'colorSwatch' },
  { key: 'titleScale', topic: 'Text', label: 'Title size', min: .5, max: 3, step: .05,
    note: 'Multiplies the title on top of the overall text size.' },
  { key: 'speakerScale', topic: 'Text', label: 'Speaker size', min: .5, max: 3, step: .05 },
  { key: 'lineHeight', topic: 'Text', label: 'Line spacing', min: 1, max: 2.4, step: .05 },
  { key: 'letterSpacing', topic: 'Text', label: 'Letter spacing (em)', min: -.05, max: .4, step: .01 },
  { key: 'textMaxWidth', topic: 'Text', label: 'Line length (characters)', min: 30, max: 120, step: 1, integer: true,
    note: 'How long a line of narration may run before it wraps.' },
  { key: 'textFont', topic: 'Text', label: 'Narration typeface', type: 'choice',
    choices: { display: 'Display serif', body: 'Body sans' } },
  // ---- the container, in detail --------------------------------------------
  { key: 'boxPadding', topic: 'Text', label: 'Container padding (rem)', min: 0, max: 6, step: .1 },
  { key: 'boxRadius', topic: 'Text', label: 'Container corner radius (px)', min: 0, max: 40, step: 1, integer: true },
  { key: 'boxBorderWidth', topic: 'Text', label: 'Container border (px)', min: 0, max: 6, step: .5 },
  { key: 'boxBorderColor', topic: 'Text', label: 'Container border colour', type: 'colorSwatch' },
  { key: 'boxBlur', topic: 'Text', label: 'Blur behind the container (px)', min: 0, max: 20, step: .5,
    note: 'Frosts the artwork behind the words instead of covering it.' },
]);

function stageRowSpec(field) {
  if (field.type === 'choice') return { type: 'choice', dropdown: true, choices: Object.keys(field.choices), choiceLabels: field.choices };
  if (field.type === 'colorSwatch') return { type: 'colorSwatch', swatches: PROLOGUE_SWATCHES };
  if ('min' in field) return { type: 'number', min: field.min, max: field.max, step: field.step ?? 1, integer: field.integer === true };
  return {};
}

/**
 * prologueStaging(config, scene) → the staging this scene is actually drawn in.
 *
 * One toggle per scene, not one per field: `ownStaging` says the scene answers
 * for itself, and then every value comes from its own block. Mixing the two
 * halves field by field would mean a second toggle for each of the twenty-odd
 * values above, and a scene whose frame came from one place and whose text came
 * from another is not a thing anyone can picture while editing it.
 */
export function prologueStaging(config, scene) {
  const base = config.presentation;
  if (!scene?.ownStaging || !scene.stage) return base;
  const staged = { ...base };
  // A SCENE'S BLOCK HOLDS ONLY WHAT IT ANSWERS FOR ITSELF. It shipped as a full
  // copy of the house style, which quietly opted `night` — the one scene that
  // needs its own wash — out of every other staging setting the owner changed:
  // turning the opening's wireframe to letterbox moved four scenes of five.
  // Anything the scene has not set follows the house style, as the toggle's own
  // label ("Use its own staging") promises for the things it has set.
  for (const field of PROLOGUE_STAGE_FIELDS) {
    if (scene.stage[field.key] !== undefined) staged[field.key] = scene.stage[field.key];
  }
  return staged;
}

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

let ROW_CACHE = null;
export function prologueRows() {
  if (ROW_CACHE) return ROW_CACHE;
  const rows = ROW_CACHE = [];
  const add = (path, label, topic, options = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Opening', prologueTopic: topic,
    key: prologueSettingKey(path), prologuePath: path,
    // A scene's staging block is sparse — it holds only what that scene answers
    // for itself — so a row with nothing authored under it shows the house
    // style's value, which is what the scene is drawn in until it is edited.
    def: get(PROLOGUE_DEFAULTS, path) ?? (path[0] === 'scenes' && path[2] === 'stage' ? PROLOGUE_DEFAULTS.presentation[path[3]] : undefined),
    label,
    note: 'Saved with your configuration. Applies to previews and new openings.', ...options,
  });
  const number = (min, max, step = .1) => ({ type: 'number', min, max, step, integer: false });
  const whole = (min, max) => ({ type: 'number', min, max, step: 1, integer: true });
  const choice = (choices, choiceLabels) => ({ type: 'choice', choices, choiceLabels, dropdown: true });
  const text = (maxLength = 1000) => ({ type: 'textarea', maxLength });
  add(['presentation', 'playback'], 'Show opening', 'Playback', choice(['every','once','off'], {every:'Every new game',once:'First time per profile',off:'Off'}));
  add(['presentation', 'autoAdvance'], 'Advance scenes automatically', 'Playback');
  add(['presentation', 'speed'], 'Playback speed', 'Playback', number(.25,3,.25));
  add(['presentation', 'reduceMotion'], 'Still artwork', 'Playback', {note:'Disables fades and camera movement. The accessibility Reduced motion setting is also respected.'});
  add(['presentation', 'tintSource'], 'Artwork tint follows', 'Motif', choice(['accent','character','custom'], {accent:'Interface accent',character:'Character tint',custom:'Custom colour'}));
  add(['presentation', 'customTint'], 'Custom artwork colour', 'Motif', {type:'color'});
  add(['presentation', 'shadowStrength'], 'Character shadow strength', 'Motif', number(0,1,.05));
  // The house style: what a scene is staged in unless it answers for itself.
  for (const field of PROLOGUE_STAGE_FIELDS) {
    add(['presentation', field.key], field.label, field.topic, {
      ...stageRowSpec(field),
      note: `${field.note ? `${field.note} ` : ''}Applies to every scene that does not keep its own staging.`,
    });
  }
  add(['presentation', 'bannerPosition'], 'Banner position', 'Stage', choice(['top','bottom'], {top:'Across the top',bottom:'Across the bottom'}));
  // THE CONTROLS ARE THE FRAME'S, NOT THE TEXT'S. They used to ride inside the
  // caption, so a wireframe that floats the words to the middle of the picture
  // floated Continue with them. They sit in a bar along the bottom unless the
  // owner asks for them back under the text.
  add(['presentation', 'controlsPosition'], 'Where the buttons sit', 'Controls', {...choice(['bar','text'], {bar:'A bar along the bottom',text:'Under the text'}),note:'The bar stays at the bottom of the screen whatever the wireframe does with the words.'});
  add(['presentation', 'controlsAlign'], 'Button alignment', 'Controls', choice(['left','center','right'], {left:'Left',center:'Centred',right:'Right'}));
  add(['presentation', 'controlsSize'], 'Button size', 'Controls', choice(['compact','normal','large'], {compact:'Compact',normal:'Normal',large:'Large'}));
  add(['presentation', 'showPause'], 'Show Pause', 'Controls');
  add(['presentation', 'showSkip'], 'Show Skip opening', 'Controls', {note:'With this off the opening has no skip button and plays through to Set forth. Playback → Show opening turns the whole opening off instead.'});
  add(['presentation', 'advanceOnClick'], 'Click the artwork to continue', 'Controls', {note:'Anywhere on the picture advances the scene, as well as the Continue button.'});
  for (const [index, scene] of PROLOGUE_DEFAULTS.scenes.entries()) {
    const path = ['scenes', String(index)];
    add([...path,'name'], 'Scene title', scene.name, text(160));
    add([...path,'enabled'], 'Play this scene', scene.name, {note:'Off shortens the opening by one scene. The opening always keeps at least one.'});
    add([...path,'order'], 'Position in the opening', scene.name, {...whole(1,PROLOGUE_DEFAULTS.scenes.length),note:'Scenes play in this order, lowest first. Ties keep their authored order.'});
    add([...path,'art'], 'Scene artwork', scene.name, {...choice(PROLOGUE_ART_CHOICES,PROLOGUE_ART_LABELS),note:'Which painting plays under this scene. Any scene may borrow another scene’s art, or none at all for a text card.'});
    add([...path,'banner'], 'Show a title banner', scene.name, {note:'Draws the scene title as a banner across the artwork.'});
    add([...path,'waitForInput'], 'Hold until Continue', scene.name, {note:'This scene never advances on its own, even when scenes advance automatically.'});
    add([...path,'music'], 'Music', scene.name, {...choice(Object.keys(PROLOGUE_MUSIC),PROLOGUE_MUSIC),note:'What plays from this scene onward. Keep leaves whatever the screen before it started.'});
    add([...path,'stinger'], 'Opening sound', scene.name, choice(Object.keys(PROLOGUE_STINGERS),PROLOGUE_STINGERS));
    add([...path,'speaker'], 'Speaker', scene.name, {...text(160),note:'Use {name} for the player or {class} for their class.'});
    add([...path,'text'], 'Dialogue', scene.name, {...text(5000),note:'Editable narration; line breaks are preserved. {classLine} uses the selected class’s line.'});
    add([...path,'seconds'], 'Scene duration (seconds)', scene.name, {...number(1,180),note:'Total scene time, including its transition. Default: 5 seconds. The final scene waits for Set forth.'});
    add([...path,'effect'], 'Transition effect', scene.name, choice(['fade','dip','push','ash','still'], {fade:'Crossfade',dip:'Fade through black',push:'Slow push',ash:'Ash reveal',still:'Still'}));
    if ('location' in scene) add([...path,'location'], 'Location caption', scene.name, {...text(160),note:'Use {location} to show the actual starting destination.'});
    if (scene.actor) for (const layout of ['desktop','mobile']) for (const axis of ['x','y','height']) {
      add([...path,'actor',layout,axis], `${layout === 'mobile' ? 'Mobile' : 'Desktop'} traveller ${axis === 'height' ? 'height' : axis === 'x' ? 'horizontal position' : 'foot position'} (%)`, scene.name, number(axis === 'height' ? 10 : 0,100,1));
    }
    // ONE TOGGLE, THEN THE SCENE'S OWN COPY OF THE WHOLE STAGING.
    add([...path,'ownStaging'], 'Use its own staging', scene.name, {note:'Off follows the opening’s Stage and Text settings. On, the rows below decide this scene alone — one scene may letterbox while the rest fill the frame.'});
    for (const field of PROLOGUE_STAGE_FIELDS) {
      add([...path,'stage',field.key], `Its own ${field.label.replace(/^(\w)/, (letter) => letter.toLowerCase())}`, scene.name, {
        ...stageRowSpec(field),
        note: `${field.note ? `${field.note} ` : ''}Read only while this scene uses its own staging.`,
      });
    }
  }
  for (const [id, cls] of Object.entries(PROLOGUE_DEFAULTS.classes)) add(['classes',id,'line'], `${cls.name} dialogue`, 'Class dialogue', text(5000));
  for (const key of Object.keys(PROLOGUE_DEFAULTS.labels)) add(['labels',key], `${PROLOGUE_DEFAULTS.labels[key]} button text`, 'Button text', text(160));
  add(['presentation','previewClass'], 'Preview class', 'Preview', choice(Object.keys(PROLOGUE_DEFAULTS.classes),Object.fromEntries(Object.entries(PROLOGUE_DEFAULTS.classes).map(([id,cls])=>[id,cls.name]))));
  // `road` was cut. A configuration that points the preview at it opens on the
  // scene that followed it rather than refusing the entire file.
  add(['presentation','previewScene'], 'Preview starting scene', 'Preview', {...choice(PROLOGUE_DEFAULTS.scenes.map(s=>s.id),Object.fromEntries(PROLOGUE_DEFAULTS.scenes.map(s=>[s.id,s.name]))), legacyChoices:{[PROLOGUE_CUT_SCENE_ID]:PROLOGUE_CUT_SCENE_HEIR}});
  rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Scenes',type:'sceneList',key:'prologueSceneList',
    label:'The opening, in order',
    note:'Drag a scene, or use its arrows, to change where it plays. Add starts an empty scene in the next free slot, Duplicate copies the one beside it, and Remove empties a slot and switches it off. The five shipped scenes are never removed — switch one off instead.'});
  for (const id of PROLOGUE_PRESET_IDS) {
    add(['presets',id,'name'], `${PROLOGUE_DEFAULTS.presets[id].name} — name`, 'Preset slots', {...text(60),note:'What to call this slot.'});
    rows.push({cat:'Advanced',advancedGroup:'Opening',prologueTopic:'Preset slots',type:'presetSlot',
      key:prologueSettingKey(['presets',id,'data']), presetId:id, nameKey:prologueSettingKey(['presets',id,'name']),
      def:'', maxLength:PROLOGUE_SLOT_LIMIT, label:PROLOGUE_DEFAULTS.presets[id].name,
      note:'Save parks the whole opening here; Load brings it back, replacing every opening setting; Clear empties the slot. Slots travel in your configuration file.'});
  }
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

/** Is this a value the row would accept? One test, asked by the config and the slots. */
export function prologueValueIsValid(row, value) {
  if (row.type === 'choice') return row.choices.includes(value);
  if (['color', 'colorSwatch'].includes(row.type)) return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  if (['textarea', 'text', 'presetSlot'].includes(row.type)) return typeof value === 'string' && value.length <= (row.maxLength ?? 1000);
  if (row.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= row.min && value <= row.max && (!row.integer || Number.isInteger(value));
  return typeof value === 'boolean';
}

export function prologueConfig(settings = {}) {
  const config = structuredClone(PROLOGUE_DEFAULTS);
  for (const row of prologueRows()) {
    // A profile written before the reorder still holds positional keys; read
    // them under the name they meant then (see migratePrologueSettingKey).
    const legacy = legacyPrologueSettingKey(row.key);
    const value = settings[row.key] ?? (legacy === null ? undefined : settings[legacy]);
    if (value === undefined || !row.prologuePath) continue;
    if (prologueValueIsValid(row, value)) put(config,row.prologuePath,value);
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
  // THE STAND-IN IS THE OPENING AS IT SHIPPED — the five authored scenes, in
  // authored order. Standing in every scene meant the four empty slots played
  // too: four blank text cards, and a progress readout of nine.
  if (!kept.length) return config.scenes.map((scene, index) => index).filter((index) => !isPrologueSlot(config.scenes[index]));
  return prologueStagedOrder(config).filter((index) => config.scenes[index].enabled !== false);
}

/**
 * Every scene, in the order they WOULD play — the staging before inclusion.
 *
 * Exported because the list editor shows exactly this: the opening as staged,
 * with the scenes that are switched off still standing in their own places. A
 * list of "playing, then everything else" would renumber every parked scene to
 * the end the first time anything else moved.
 */
export function prologueStagedOrder(config) {
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
  const staged = prologueStagedOrder(config);
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

/**
 * The painting a scene draws on: its own by default, any shipped one by
 * setting, and `null` for a scene that wants no painting at all — a text card,
 * which is what an added scene starts as, since a new scene has no art to ship.
 */
export function prologueSceneArt(scene) {
  if (scene?.art === 'none') return null;
  return PROLOGUE_ART_IDS.includes(scene?.art) ? scene.art : scene?.id;
}

/** The slots are the scenes the owner may add, empty and switched off. */
export function isPrologueSlot(scene) {
  return PROLOGUE_SLOT_IDS.includes(scene?.id);
}

/**
 * THE LIST EDITOR'S THREE WRITES, HELD IN THE MODEL.
 *
 * Reordering, duplicating and emptying a scene are all "rewrite this set of
 * keys", and every one of them has an invariant worth a test: the running order
 * is 1..n with no gaps, a copy carries EVERY field the source has rather than
 * the handful someone remembered, and emptying a slot restores the authored
 * blank rather than writing a second kind of empty. None of that is about the
 * DOM, so none of it lives in the screen.
 */
export function prologueReorderChanges(ids) {
  const known = PROLOGUE_DEFAULTS.scenes.map((scene) => scene.id);
  if (ids.length !== known.length || new Set(ids).size !== ids.length || ids.some((id) => !known.includes(id))) {
    throw new Error('A reorder must name every scene exactly once.');
  }
  return Object.fromEntries(ids.map((id, index) => [`${PROLOGUE_PREFIX}scenes.${id}.order`, index + 1]));
}

/** The keys that belong to one scene, and the row each answers to. */
function sceneRows(id) {
  const prefix = `${PROLOGUE_PREFIX}scenes.${id}.`;
  return prologueRows().filter((row) => row.key.startsWith(prefix)).map((row) => [row.key.slice(prefix.length), row]);
}

export function prologueSceneCopy(settings, fromId, toId) {
  const target = new Map(sceneRows(toId));
  const changes = {};
  for (const [field, row] of sceneRows(fromId)) {
    // A field the target has no row for (a traveller's position, a location
    // caption) is a field the target cannot hold; it is skipped, not invented.
    if (!target.has(field)) continue;
    const value = settings[row.key] ?? row.def;
    if (value !== undefined) changes[target.get(field).key] = value;
  }
  const name = settings[`${PROLOGUE_PREFIX}scenes.${fromId}.name`]
    ?? PROLOGUE_DEFAULTS.scenes.find((scene) => scene.id === fromId)?.name ?? fromId;
  changes[`${PROLOGUE_PREFIX}scenes.${toId}.name`] = `${name} (copy)`.slice(0, 160);
  changes[`${PROLOGUE_PREFIX}scenes.${toId}.enabled`] = true;
  return changes;
}

export function prologueSceneClear(id) {
  // `undefined` is how this codebase unsets a key, and the authored slot is
  // already empty and switched off — so clearing is restoring, not overwriting.
  return Object.fromEntries(sceneRows(id).map(([, row]) => [row.key, undefined]));
}

/** The next slot that is off and has nothing written in it, or null. */
export function prologueFreeSlot(config) {
  return config.scenes.find((scene) => isPrologueSlot(scene) && scene.enabled === false && !String(scene.text || '').trim())?.id ?? null;
}

/**
 * A PRESET SLOT IS THE OPENING, PARKED — the same overrides a scene file
 * carries, held as one string in the profile so switching between two openings
 * is a button rather than a download and an upload. The slots themselves are
 * never inside the payload: parking opening A inside slot 1 while slot 1 is
 * inside opening A is a room of mirrors, and it would double in size each save.
 */
export const PROLOGUE_SLOT_LIMIT = 40000;
const PRESET_PREFIX = `${PROLOGUE_PREFIX}presets.`;

export function prologueSlotPayload(settings = {}) {
  const entries = Object.entries(settings)
    .filter(([key, value]) => key.startsWith(PROLOGUE_PREFIX) && !key.startsWith(PRESET_PREFIX) && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const payload = JSON.stringify(Object.fromEntries(entries));
  if (payload.length > PROLOGUE_SLOT_LIMIT) throw new Error('This opening is too long to park in a slot. Export it to a file instead.');
  return payload;
}

/**
 * prologueSlotChanges(data, settings) → the change set that makes the profile's
 * opening this slot's opening — INCLUDING the keys it has to take away.
 *
 * Loading a slot is a replacement, not a merge: an override the profile holds
 * and the slot does not is set back to `undefined`, which is how this codebase
 * says "unset" through onChange. Merging instead would leave a scene switched
 * off by the opening you were editing a moment ago, with nothing on screen to
 * say why.
 */
export function prologueSlotChanges(data, settings = {}) {
  let parsed;
  try { parsed = JSON.parse(String(data || '')); } catch { throw new Error('That slot is empty or unreadable.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('That slot is empty or unreadable.');
  const rows = new Map(prologueRows().map((row) => [row.key, row]));
  const changes = {};
  for (const key of Object.keys(settings)) {
    if (key.startsWith(PROLOGUE_PREFIX) && !key.startsWith(PRESET_PREFIX)) changes[key] = undefined;
  }
  for (const [key, value] of migratePrologueEntries(Object.entries(parsed))) {
    const row = rows.get(key);
    if (!row || key.startsWith(PRESET_PREFIX)) throw new Error(`That slot holds a setting this version does not know: ${key}.`);
    if (!prologueValueIsValid(row, value)) throw new Error(`That slot holds a value this version refuses: ${row.label}.`);
    changes[key] = value;
  }
  return changes;
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
    || !Array.isArray(preset.scenes) || !preset.scenes.length
    || new Set(preset.scenes.map(s=>s?.id)).size !== preset.scenes.length) throw new Error('Invalid opening preset. Nothing was imported.');
  // A SUBSET IS A LEGAL FILE. The art studio's own exports predate the four
  // empty slots and carry five scenes; demanding the current count refused
  // every file written before this build over scenes it says nothing about.
  // Unknown ids are still refused — that is a file for a different game.
  if (preset.scenes.some(scene=>!PROLOGUE_DEFAULTS.scenes.some(known=>known.id===scene?.id))) throw new Error('Opening preset has an unknown scene. Nothing was imported.');
  const source = {...preset, scenes:PROLOGUE_DEFAULTS.scenes.map(scene=>preset.scenes.find(s=>s?.id===scene.id) || {})};
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
