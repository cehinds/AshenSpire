import { openModal } from '../kit/index.js';
import { anchorLocalBox } from '../fx.js';
import { mountPrologue } from './prologue.js';
import { placePrologueCharacter } from '../prologueCharacter.js';
import {
  prologueConfig, prologueRows, prologueSequence, prologueSettingKey,
  prologueStaging, PROLOGUE_DEFAULTS, PROLOGUE_STAGE_FIELDS,
} from '../../model/prologue.js';

const STAGE_BY_KEY = new Map(PROLOGUE_STAGE_FIELDS.map(field => [field.key, field]));
const SCENE_GROUPS = [
  ['Words & artwork', ['name', 'art', 'banner', 'speaker', 'text', 'location']],
  ['Traveller', []],
  ['Playback & sound', ['seconds', 'effect', 'waitForInput', 'music', 'stinger']],
];
const STAGE_GROUPS = [
  ['Picture & frame', ['layout', 'imageFit', 'imageScale', 'imageFocusX', 'imageFocusY', 'wash', 'imageBrightness', 'imageContrast', 'imageSaturation', 'imageBlur', 'imageFlip', 'vignette', 'backdropColor', 'letterboxColor']],
  ['Text placement', ['textPosition', 'textAlign', 'textScale', 'textInsetX', 'textInsetY', 'titleVisible', 'speakerVisible', 'locationVisible', 'progressStyle']],
  ['Readability', ['textBox', 'textBoxVisible', 'textBoxColor', 'textBoxOpacity', 'textOutline', 'textOutlineColor', 'textOutlineWidth', 'dialogueColor', 'titleColor', 'speakerColor', 'locationColor', 'boxBlur']],
  ['Typography', ['textMaxWidth', 'lineHeight', 'letterSpacing', 'textFont', 'titleScale', 'speakerScale', 'boxPadding', 'boxRadius', 'boxBorderWidth', 'boxBorderColor']],
  ['Motion & transitions', ['camera', 'cameraAmount', 'cameraEase', 'transitionSeconds', 'transitionEase', 'reveal', 'revealSpeed', 'textDelaySeconds']],
];

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function select(label, options, value) {
  const box = element('label', 'pse-select');
  box.append(element('span', '', label));
  const input = element('select');
  for (const [id, name] of options) {
    const option = new Option(name, id);
    option.selected = id === value;
    input.append(option);
  }
  box.append(input);
  return [box, input];
}

function rowIndex() {
  return new Map(prologueRows().filter(row => row.prologuePath).map(row => [row.key, row]));
}

/**
 * One focused workspace for the opening's existing settings. The real scene
 * renderer supplies the preview; no second drawing path can drift from play.
 * Writes use the same keys and onChange callback as Settings and JSON exports.
 */
export function openPrologueSceneEditor(settings, onChange, { sceneId = null, tab = 'Words & artwork' } = {}) {
  const initial = prologueConfig(settings);
  const first = prologueSequence(initial)[0];
  let selected = initial.scenes.some(scene => scene.id === sceneId) ? sceneId : initial.scenes[first]?.id;
  let path = 'crownfall';
  let layout = matchMedia('(max-width: 760px) and (orientation: portrait)').matches ? 'mobile' : 'desktop';
  let group = tab;
  let cleanup = null;
  let refreshTimer = null;
  let actorObserver = null;
  const rows = rowIndex();
  const door = openModal({
    size: 'xl', className: 'prologue-scene-editor', title: 'Opening scene editor',
    bodyClassName: 'pse-body', onClose: () => { clearTimeout(refreshTimer); actorObserver?.disconnect(); cleanup?.(); },
  });
  const host = door.body;
  const toolbar = element('div', 'pse-toolbar');
  const [scenePicker, sceneInput] = select('Scene', initial.scenes.map(scene => [scene.id, scene.name || scene.id]), selected);
  const [pathPicker, pathInput] = select('Starting path', [
    ['crownfall', 'Crownfall'], ['weald', 'Hollow Weald'], ['marches', 'Pale Marches · tundra'], ['reach', 'Cinder Reach'],
  ], path);
  const [classPicker, classInput] = select('Traveller', Object.entries(PROLOGUE_DEFAULTS.classes).map(([id, cls]) => [id, cls.name]), initial.presentation.previewClass);
  const [layoutPicker, layoutInput] = select('Preview size', [['desktop', 'Desktop'], ['mobile', 'Mobile']], layout);
  toolbar.append(scenePicker, pathPicker, classPicker, layoutPicker);

  const workspace = element('div', 'pse-workspace');
  const visual = element('div', 'pse-visual');
  const visualNote = element('p', 'pse-visual-note', 'Live preview · your changes save as you edit');
  const viewport = element('div', 'pse-viewport');
  const resizeHandle = element('button', 'pse-resize-handle', '↗');
  resizeHandle.type = 'button';
  resizeHandle.setAttribute('aria-label', 'Drag to resize traveller');
  resizeHandle.title = 'Drag up to enlarge or down to shrink the traveller';
  resizeHandle.hidden = true;
  visual.append(visualNote, viewport);
  const inspector = element('div', 'pse-inspector');
  const mode = element('div', 'pse-mode');
  const modeSummary = element('p', 'pse-mode-summary');
  const modeButton = element('button', 'as-btn pse-mode-button');
  modeButton.type = 'button';
  mode.append(modeSummary, modeButton);
  const tabs = element('div', 'pse-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Scene editor controls');
  const fields = element('div', 'pse-fields');
  inspector.append(mode, tabs, fields);
  workspace.append(visual, inspector);
  host.append(toolbar, workspace);

  const configScene = () => prologueConfig(settings).scenes.find(scene => scene.id === selected);
  const saved = (key, value) => {
    const had = Object.hasOwn(settings, key);
    const old = settings[key];
    if (value === undefined) delete settings[key]; else settings[key] = value;
    if (onChange({ [key]: value })?.ok === false) {
      if (had) settings[key] = old; else delete settings[key];
      modeSummary.textContent = 'Could not save this change. Your previous value is still in use.';
      return false;
    }
    return true;
  };
  const alignResizeHandle = () => {
    const actor = viewport.querySelector('.prologue-actor');
    const visible = scope === 'scene' && group === 'Traveller' && actor;
    resizeHandle.hidden = !visible;
    if (!visible) return;
    const actorBox = anchorLocalBox(viewport, actor);
    resizeHandle.style.left = `${actorBox.left + actorBox.width * .72}px`;
    resizeHandle.style.top = `${actorBox.top + actorBox.height * .08}px`;
  };
  const preview = () => {
    cleanup?.();
    viewport.classList.toggle('pse-phone', layout === 'mobile');
    const config = prologueConfig(settings);
    const index = config.scenes.findIndex(scene => scene.id === selected);
    const run = { class: classInput.value, seatOrder: path === 'crownfall' ? [] : [path],
      journey: path === 'crownfall' ? { anchors: { start: 'crownfall' } } : undefined };
    cleanup = mountPrologue(viewport, { settings, run, startScene: index, preview: true, editorPreview: true, forceLayout: layout });
    viewport.append(resizeHandle);
    alignResizeHandle();
  };
  actorObserver = new MutationObserver(alignResizeHandle);
  actorObserver.observe(viewport, { childList: true, subtree: true });
  let drag = null;
  const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
  viewport.addEventListener('pointerdown', event => {
    if (scope !== 'scene' || group !== 'Traveller') return;
    const resizing = event.target === resizeHandle;
    const actor = resizing ? viewport.querySelector('.prologue-actor') : event.target.closest?.('.prologue-actor');
    const stage = actor?.closest('.prologue-stage');
    const position = configScene()?.actor?.[layout];
    if (!stage || !position) return;
    drag = { id: event.pointerId, actor, stage, position: { ...position }, x: event.clientX, y: event.clientY, resizing };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('pse-dragging');
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = drag.stage.getBoundingClientRect();
    drag.next = drag.resizing ? {
      ...drag.position,
      height: Math.max(10, clamp(drag.position.height + (drag.y - event.clientY) / rect.height * 100)),
    } : {
      ...drag.position,
      x: clamp(drag.position.x + (event.clientX - drag.x) / rect.width * 100),
      y: clamp(drag.position.y + (event.clientY - drag.y) / rect.height * 100),
    };
    placePrologueCharacter(drag.actor, drag.next);
    alignResizeHandle();
  });
  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { actor, position, next } = drag;
    if (event.type === 'pointerup' && next) {
      for (const axis of drag.resizing ? ['height'] : ['x', 'y']) {
        saved(prologueSettingKey(['scenes', selected, 'actor', layout, axis]), next[axis]);
      }
      drawFields();
      schedulePreview();
    } else { placePrologueCharacter(actor, position); alignResizeHandle(); }
    viewport.classList.remove('pse-dragging');
    viewport.releasePointerCapture(event.pointerId);
    drag = null;
  };
  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
  const schedulePreview = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(preview, 180);
  };
  const inputFor = (row, value, key, inherited) => {
    let input;
    if (row.type === 'textarea') {
      input = element('textarea'); input.maxLength = row.maxLength;
      input.rows = key.endsWith('.text') ? 6 : 2;
      input.value = String(value ?? '');
    } else if (row.type === 'choice') {
      input = element('select');
      for (const id of row.choices) {
        const option = new Option(row.choiceLabels?.[id] || id, id);
        option.selected = id === value;
        input.append(option);
      }
    } else if (row.type === 'number') {
      input = element('input'); input.type = 'number';
      input.min = row.min; input.max = row.max; input.step = row.step ?? 1;
      input.value = String(value ?? row.def ?? '');
    } else if (row.type === 'colorSwatch' || row.type === 'color') {
      input = element('input'); input.type = 'color'; input.value = value || '#100e0c';
    } else {
      input = element('input'); input.type = 'checkbox'; input.checked = Boolean(value);
    }
    input.dataset.editorKey = key;
    input.id = `pse-${key.replace(/[^a-z0-9]/gi, '-')}`;
    input.setAttribute('aria-label', row.label);
    if (inherited) input.disabled = true;
    const commit = (normalize = true) => {
      let next = input.type === 'checkbox' ? input.checked : input.value;
      if (row.type === 'number') {
        const parsed = Number(next);
        if (!Number.isFinite(parsed)) return;
        if (!normalize && (parsed < row.min || parsed > row.max)) return;
        next = Math.max(row.min, Math.min(row.max, row.integer ? Math.round(parsed) : parsed));
        if (normalize) input.value = String(next);
      }
      if (saved(key, next)) {
        if (key === prologueSettingKey(['scenes', selected, 'name'])) sceneInput.selectedOptions[0].textContent = String(next);
        const follow = input.closest('.pse-field')?.querySelector('.pse-follow');
        if (follow) { follow.disabled = false; follow.textContent = 'Use opening style'; }
        schedulePreview();
      }
    };
    if (row.type === 'number') {
      input.addEventListener('input', () => commit(false));
      input.addEventListener('change', () => commit(true));
    } else {
      input.addEventListener(row.type === 'textarea' || input.type === 'color' ? 'input' : 'change', () => commit());
    }
    return input;
  };
  const field = (row, value, key, { inherited = false, reset = false, stage = false } = {}) => {
    const wrap = element('div', 'pse-field');
    const head = element('span', 'pse-field-head');
    const title = element('label', '', stage ? STAGE_BY_KEY.get(row.prologuePath.at(-1))?.label || row.label : row.label);
    title.htmlFor = `pse-${key.replace(/[^a-z0-9]/gi, '-')}`;
    head.append(title);
    if (reset) {
      const follow = element('button', 'pse-follow', settings[key] === undefined ? 'Following opening style' : 'Use opening style');
      follow.type = 'button'; follow.disabled = settings[key] === undefined;
      follow.title = 'Remove this scene’s override for this setting';
      follow.addEventListener('click', event => {
        event.preventDefault();
        if (saved(key, undefined)) { drawFields(); schedulePreview(); }
      });
      head.append(follow);
    }
    wrap.append(head, inputFor(row, value, key, inherited));
    const note = stage ? STAGE_BY_KEY.get(row.prologuePath.at(-1))?.note : row.note;
    if (note) wrap.append(element('small', '', note));
    return wrap;
  };
  const stageRows = (keys, scope) => {
    const config = prologueConfig(settings);
    const scene = config.scenes.find(item => item.id === selected);
    const effective = prologueStaging(config, scene);
    return keys.map(name => {
      const key = scope === 'defaults'
        ? prologueSettingKey(['presentation', name])
        : prologueSettingKey(['scenes', selected, 'stage', name]);
      const row = rows.get(key);
      return row ? field(row, effective[name], key, {
        inherited: scope !== 'defaults' && !scene.ownStaging,
        reset: scope !== 'defaults' && scene.ownStaging,
        stage: true,
      }) : null;
    }).filter(Boolean);
  };
  let scope = 'scene';
  const drawFields = () => {
    const scene = configScene();
    const custom = scene.ownStaging === true;
    modeSummary.textContent = scope === 'defaults'
      ? 'Opening style · shared by scenes without a private override.'
      : custom ? `${scene.name} · custom staging is on. Unchanged fields still follow the opening style.`
        : `${scene.name} · frame and text follow the opening style.`;
    modeButton.textContent = scope === 'defaults' ? 'Return to this scene' : 'Edit opening style';
    tabs.replaceChildren(); fields.replaceChildren();
    const groups = scope === 'defaults' ? STAGE_GROUPS
      : [...SCENE_GROUPS.filter(([name]) => name !== 'Traveller' || scene.actor), ...STAGE_GROUPS];
    if (!groups.some(([name]) => name === group)) group = groups[0][0];
    viewport.classList.toggle('pse-positioning', scope === 'scene' && group === 'Traveller');
    alignResizeHandle();
    for (const [name] of groups) {
      const tab = element('button', `pse-tab${name === group ? ' on' : ''}`, name);
      tab.type = 'button'; tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(name === group));
      tab.addEventListener('click', () => { group = name; drawFields(); });
      tabs.append(tab);
    }
    if (scope === 'scene' && STAGE_GROUPS.some(([name]) => name === group)) {
      const toggle = element('label', 'pse-custom');
      const check = element('input'); check.type = 'checkbox'; check.checked = custom;
      check.addEventListener('change', () => {
        if (saved(prologueSettingKey(['scenes', selected, 'ownStaging']), check.checked)) {
          drawFields(); schedulePreview();
        }
      });
      toggle.append(check, element('span', '', 'Customize this scene’s staging'));
      fields.append(toggle);
    }
    if (scope === 'scene' && SCENE_GROUPS.some(([name]) => name === group)) {
      if (group === 'Traveller') {
        fields.append(element('p', 'pse-group-help', `Drag the traveller to place them. Drag the gold ↗ handle to resize; drag up to enlarge or down to shrink. You can also use exact values below. Switch Preview size above to set ${layout === 'mobile' ? 'desktop' : 'mobile'} placement separately.`));
        for (const axis of ['x', 'y', 'height']) {
          const key = prologueSettingKey(['scenes', selected, 'actor', layout, axis]);
          const row = rows.get(key);
          if (row) {
            const control = field(row, scene.actor?.[layout]?.[axis], key);
            const numberInput = control.querySelector('input[type=number]');
            const slider = element('input', 'pse-position-slider');
            slider.type = 'range'; slider.min = row.min; slider.max = row.max; slider.step = row.step ?? 1;
            slider.value = numberInput.value;
            slider.setAttribute('aria-label', `${row.label} slider`);
            slider.addEventListener('input', () => {
              numberInput.value = slider.value;
              numberInput.dispatchEvent(new Event('input', { bubbles: true }));
            });
            numberInput.addEventListener('input', () => { slider.value = numberInput.value; });
            control.append(slider);
            fields.append(control);
          }
        }
      } else {
        const names = SCENE_GROUPS.find(([name]) => name === group)[1];
        for (const name of names) {
          const key = prologueSettingKey(['scenes', selected, name]);
          const row = rows.get(key);
          if (row) fields.append(field(row, scene[name], key));
        }
      }
    } else {
      const names = STAGE_GROUPS.find(([name]) => name === group)?.[1] || [];
      fields.append(...stageRows(names, scope));
    }
  };
  modeButton.addEventListener('click', () => { scope = scope === 'scene' ? 'defaults' : 'scene'; drawFields(); });
  sceneInput.addEventListener('change', () => { selected = sceneInput.value; scope = 'scene'; group = 'Words & artwork'; drawFields(); preview(); });
  pathInput.addEventListener('change', () => { path = pathInput.value; preview(); });
  classInput.addEventListener('change', preview);
  layoutInput.addEventListener('change', () => { layout = layoutInput.value; drawFields(); preview(); });
  drawFields(); preview();
  return door;
}
