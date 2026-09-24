import { openModal } from '../kit/index.js';
import { mountPrologue } from './prologue.js';
import { CHARACTER_LAYER_HEIGHT, placePrologueCharacter } from '../prologueCharacter.js';
import { anchorLocalBox } from '../fx.js';
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
  ['Readability', ['textBox', 'textBoxVisible', 'textBoxColor', 'textBoxOpacity', 'captionFixedHeight', 'captionHeightVh', 'bannerBox', 'bannerBoxColor', 'bannerBoxOpacity', 'textOutline', 'textOutlineColor', 'textOutlineWidth', 'dialogueColor', 'titleColor', 'speakerColor', 'locationColor', 'boxBlur']],
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
  const arrangeBar = element('div', 'pse-arrange-bar');
  const gridLabel = element('label', 'pse-arrange-toggle');
  const gridToggle = element('input'); gridToggle.type = 'checkbox';
  gridLabel.append(gridToggle, element('span', '', 'Grid'));
  const snapLabel = element('label', 'pse-arrange-toggle');
  const snapToggle = element('input'); snapToggle.type = 'checkbox';
  snapLabel.append(snapToggle, element('span', '', 'Snap'));
  const stepLabel = element('label', 'pse-arrange-step');
  stepLabel.append(element('span', '', 'Spacing'));
  const stepInput = element('input'); stepInput.type = 'number'; stepInput.min = '2'; stepInput.max = '25'; stepInput.step = '1';
  stepInput.setAttribute('aria-label', 'Grid spacing percent');
  stepLabel.append(stepInput, element('span', '', '%'));
  const projectButton = element('button', 'pse-project-save', 'Save first-step defaults');
  projectButton.type = 'button'; projectButton.hidden = true;
  const projectStatus = element('span', 'pse-project-status');
  projectStatus.setAttribute('role', 'status');
  arrangeBar.append(gridLabel, snapLabel, stepLabel, projectButton, projectStatus);
  const viewport = element('div', 'pse-viewport');
  const transformBox = element('div', 'pse-transform-box');
  transformBox.setAttribute('aria-label', 'Drag to move traveller; drag a corner to resize');
  const dimensions = element('span', 'pse-transform-dimensions');
  transformBox.append(dimensions);
  for (const corner of ['nw', 'ne', 'sw', 'se']) {
    const grip = element('span', `pse-transform-grip pse-grip-${corner}`);
    grip.dataset.corner = corner;
    transformBox.append(grip);
  }
  transformBox.hidden = true;
  visual.append(visualNote, arrangeBar, viewport);
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
  let projectWriteEnabled = false;
  fetch('/__editor/prologue-defaults').then(response => response.ok ? response.json() : null).then(result => {
    projectWriteEnabled = result?.projectDefaults === true;
    projectButton.hidden = !projectWriteEnabled || selected !== 'step';
    if (projectWriteEnabled) visualNote.textContent = 'Live preview · save first-step edits to project JSON when ready';
  }).catch(() => {});
  projectButton.addEventListener('click', async () => {
    const changes = Object.fromEntries(Object.entries(settings).filter(([key]) =>
      key.startsWith('gameConfig.prologue.scenes.step.')
      || ['editorGrid', 'editorSnap', 'editorGridStep'].some(name => key === prologueSettingKey(['presentation', name]))));
    if (!Object.keys(changes).length) { projectStatus.textContent = 'Already using project defaults.'; return; }
    projectButton.disabled = true; projectStatus.textContent = 'Saving project JSON…';
    try {
      const response = await fetch('/__editor/prologue-defaults', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save.');
      projectStatus.textContent = `Saved ${result.keys} settings to project JSON for the next build.`;
    } catch (error) { projectStatus.textContent = error.message; }
    finally { projectButton.disabled = false; }
  });
  const figureRect = actor => {
    const box = actor.getBoundingClientRect();
    const sourceHeight = actor.height / CHARACTER_LAYER_HEIGHT;
    const pad = Math.ceil(sourceHeight * .6);
    const scale = box.height / actor.height;
    return { left: box.left + pad * scale, top: box.top,
      width: (actor.width - pad * 2) * scale, height: sourceHeight * scale };
  };
  const alignTransformBox = () => {
    const actor = viewport.querySelector('.prologue-actor');
    const visible = scope === 'scene' && group === 'Traveller' && actor?.width;
    transformBox.hidden = !visible;
    if (!visible) return;
    const figure = figureRect(actor);
    const local = anchorLocalBox(viewport, figure);
    const stageBox = actor.closest('.prologue-stage').getBoundingClientRect();
    transformBox.style.left = `${local.left}px`;
    transformBox.style.top = `${local.top}px`;
    transformBox.style.width = `${local.width}px`;
    transformBox.style.height = `${local.height}px`;
    const widthVw = figure.width / stageBox.width * 100;
    const heightVh = figure.height / stageBox.height * 100;
    const sizeLabel = `${widthVw.toFixed(1)}vw × ${heightVh.toFixed(1)}vh`;
    if (dimensions.textContent !== sizeLabel) dimensions.textContent = sizeLabel;
    const widthInput = fields.querySelector('[data-pse-width-vw]');
    if (widthInput && document.activeElement !== widthInput) {
      widthInput.value = widthVw.toFixed(1);
      const slider = widthInput.closest('.pse-field')?.querySelector('input[type=range]');
      if (slider) slider.value = widthInput.value;
    }
  };
  const arrangeSettings = () => prologueConfig(settings).presentation;
  const arrange = () => {
    const config = arrangeSettings();
    gridToggle.checked = config.editorGrid === true;
    snapToggle.checked = config.editorSnap !== false;
    stepInput.value = String(config.editorGridStep || 5);
    viewport.classList.toggle('pse-show-grid', gridToggle.checked);
    viewport.classList.toggle('pse-moving-art', scope === 'scene' && group === 'Picture & frame');
    viewport.style.setProperty('--pse-grid-step', `${stepInput.value}%`);
  };
  gridToggle.addEventListener('change', () => { saved(prologueSettingKey(['presentation', 'editorGrid']), gridToggle.checked); arrange(); });
  snapToggle.addEventListener('change', () => { saved(prologueSettingKey(['presentation', 'editorSnap']), snapToggle.checked); arrange(); });
  stepInput.addEventListener('change', () => {
    const step = Math.max(2, Math.min(25, Math.round(Number(stepInput.value) || 5)));
    saved(prologueSettingKey(['presentation', 'editorGridStep']), step); arrange();
  });
  const preview = () => {
    cleanup?.();
    viewport.classList.toggle('pse-phone', layout === 'mobile');
    const config = prologueConfig(settings);
    const index = config.scenes.findIndex(scene => scene.id === selected);
    const run = { class: classInput.value, seatOrder: path === 'crownfall' ? [] : [path],
      journey: path === 'crownfall' ? { anchors: { start: 'crownfall' } } : undefined };
    cleanup = mountPrologue(viewport, { settings, run, startScene: index, preview: true, editorPreview: true, forceLayout: layout });
    viewport.append(transformBox);
    alignTransformBox();
    arrange();
  };
  actorObserver = new MutationObserver(alignTransformBox);
  actorObserver.observe(viewport, { childList: true, subtree: true });
  let drag = null;
  const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
  const snapped = value => {
    const step = arrangeSettings().editorSnap === false ? 1 : arrangeSettings().editorGridStep || 5;
    return clamp(Math.round(value / step) * step);
  };
  const syncField = (key, value) => {
    const input = [...fields.querySelectorAll('[data-editor-key]')].find(node => node.dataset.editorKey === key);
    if (!input) return;
    input.value = String(value);
    const slider = input.closest('.pse-field')?.querySelector('input[type=range]');
    if (slider) slider.value = String(value);
  };
  viewport.addEventListener('pointerdown', event => {
    if (scope !== 'scene') return;
    const actor = viewport.querySelector('.prologue-actor');
    const figure = event.target.closest?.('.pse-transform-box');
    const grip = event.target.closest?.('.pse-transform-grip');
    const stage = event.target.closest?.('.prologue-stage') || actor?.closest('.prologue-stage');
    if (group === 'Traveller' && stage && (figure || event.target.closest?.('.prologue-actor'))) {
      const position = configScene()?.actor?.[layout];
      if (!position) return;
      drag = { kind: grip ? 'resize' : 'actor', corner: grip?.dataset.corner, id: event.pointerId,
        actor, stage, position: { ...position }, figure: figureRect(actor), x: event.clientX, y: event.clientY };
    } else if (group === 'Picture & frame' && stage && stage.querySelector('.prologue-background')) {
      const config = prologueConfig(settings);
      const scene = config.scenes.find(item => item.id === selected);
      const staging = prologueStaging(config, scene);
      drag = { kind: 'art', id: event.pointerId, stage, plate: stage.querySelector('.prologue-plate'),
        position: { x: staging.imageFocusX, y: staging.imageFocusY }, x: event.clientX, y: event.clientY };
    } else return;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('pse-dragging');
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = drag.stage.getBoundingClientRect();
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.kind === 'resize') {
      const horizontal = dx * (drag.corner.includes('e') ? 1 : -1) / Math.max(1, drag.figure.width);
      const vertical = dy * (drag.corner.includes('s') ? 1 : -1) / Math.max(1, drag.figure.height);
      const change = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
      drag.next = { ...drag.position, height: Math.max(10, snapped(drag.position.height * (1 + change))) };
      placePrologueCharacter(drag.actor, drag.next);
      syncField(prologueSettingKey(['scenes', selected, 'actor', layout, 'height']), drag.next.height);
      alignTransformBox();
    } else if (drag.kind === 'actor') {
      drag.next = { ...drag.position,
        x: snapped(drag.position.x + dx / rect.width * 100),
        y: snapped(drag.position.y + dy / rect.height * 100) };
      placePrologueCharacter(drag.actor, drag.next);
      for (const axis of ['x', 'y']) syncField(prologueSettingKey(['scenes', selected, 'actor', layout, axis]), drag.next[axis]);
      alignTransformBox();
    } else {
      drag.next = { x: snapped(drag.position.x - dx / rect.width * 100),
        y: snapped(drag.position.y - dy / rect.height * 100) };
      drag.plate.style.setProperty('--prologue-focus', `${drag.next.x}% ${drag.next.y}%`);
      for (const axis of ['x', 'y']) syncField(prologueSettingKey(['scenes', selected, 'stage', `imageFocus${axis.toUpperCase()}`]), drag.next[axis]);
    }
  });
  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { actor, position, next } = drag;
    if (event.type === 'pointerup' && next) {
      if (drag.kind === 'art') {
        saved(prologueSettingKey(['scenes', selected, 'ownStaging']), true);
        for (const axis of ['x', 'y']) saved(prologueSettingKey(['scenes', selected, 'stage', `imageFocus${axis.toUpperCase()}`]), next[axis]);
      } else for (const axis of drag.kind === 'resize' ? ['height'] : ['x', 'y']) {
        saved(prologueSettingKey(['scenes', selected, 'actor', layout, axis]), next[axis]);
      }
      drawFields();
      schedulePreview();
    } else if (drag.kind === 'art') {
      drag.plate.style.setProperty('--prologue-focus', `${position.x}% ${position.y}%`);
      drawFields();
    } else { placePrologueCharacter(actor, position); alignTransformBox(); drawFields(); }
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
  const addNumericControls = (control, row, input, symbols = ['−', '+']) => {
    const step = Number(row.step) || 1;
    const stepper = element('div', 'pse-number-stepper');
    const move = direction => {
      const next = Math.max(Number(row.min), Math.min(Number(row.max), Number(input.value || 0) + direction * step));
      input.value = String(Number(next.toFixed(2)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const minus = element('button', '', symbols[0]); minus.type = 'button'; minus.setAttribute('aria-label', `Decrease ${row.label}`);
    const plus = element('button', '', symbols[1]); plus.type = 'button'; plus.setAttribute('aria-label', `Increase ${row.label}`);
    minus.disabled = input.disabled; plus.disabled = input.disabled;
    minus.addEventListener('click', () => move(-1)); plus.addEventListener('click', () => move(1));
    input.replaceWith(stepper); stepper.append(minus, input, plus);
    const slider = element('input', 'pse-position-slider');
    slider.type = 'range'; slider.min = row.min; slider.max = row.max; slider.step = step;
    slider.disabled = input.disabled;
    slider.value = input.value;
    slider.setAttribute('aria-label', `${row.label} slider`);
    slider.addEventListener('input', () => { input.value = slider.value; input.dispatchEvent(new Event('input', { bubbles: true })); });
    input.addEventListener('input', () => { slider.value = input.value; });
    control.append(slider);
    return control;
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
      if (!row) return null;
      const control = field(row, effective[name], key, {
        inherited: scope !== 'defaults' && !scene.ownStaging,
        reset: scope !== 'defaults' && scene.ownStaging,
        stage: true,
      });
      if (name === 'imageFocusX' || name === 'imageFocusY') {
        control.querySelector('label').textContent = `Painting ${name.endsWith('X') ? 'X (scene vw)' : 'Y (scene vh)'}`;
        addNumericControls(control, row, control.querySelector('input[type=number]'), name.endsWith('X') ? ['←', '→'] : ['↑', '↓']);
      }
      return control;
    }).filter(Boolean);
  };
  let scope = 'scene';
  const drawFields = () => {
    const scene = configScene();
    projectButton.hidden = !projectWriteEnabled || selected !== 'step';
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
    alignTransformBox();
    arrange();
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
        fields.append(element('p', 'pse-group-help', `Drag the box to place the traveller; pull any corner to scale. X and Y are positions in scene vw/vh. The width and height controls keep the figure's proportions. Switch Preview size to set ${layout === 'mobile' ? 'desktop' : 'mobile'} separately.`));
        for (const axis of ['x', 'y', 'height']) {
          const key = prologueSettingKey(['scenes', selected, 'actor', layout, axis]);
          const row = rows.get(key);
          if (row) {
            const control = field(row, scene.actor?.[layout]?.[axis], key);
            const numberInput = control.querySelector('input[type=number]');
            control.querySelector('label').textContent = axis === 'x' ? 'Traveller X (scene vw)'
              : axis === 'y' ? 'Traveller Y / feet (scene vh)' : 'Traveller height (scene vh)';
            fields.append(addNumericControls(control, row, numberInput, axis === 'x' ? ['←', '→'] : axis === 'y' ? ['↑', '↓'] : ['−', '+']));
          }
        }
        const widthControl = element('div', 'pse-field');
        const widthLabel = element('label', '', 'Traveller width (scene vw)');
        widthLabel.htmlFor = 'pse-traveller-width';
        const widthInput = element('input'); widthInput.type = 'number'; widthInput.id = 'pse-traveller-width';
        widthInput.min = '2'; widthInput.max = '100'; widthInput.step = '.1'; widthInput.dataset.pseWidthVw = 'true';
        const widthRow = { label: 'Traveller width', min: 2, max: 100, step: .1 };
        widthInput.addEventListener('input', () => {
          const actor = viewport.querySelector('.prologue-actor');
          const stage = actor?.closest('.prologue-stage');
          const desired = Number(widthInput.value);
          if (!actor || !stage || !Number.isFinite(desired) || desired < 2 || desired > 100) return;
          const current = figureRect(actor).width / stage.getBoundingClientRect().width * 100;
          const position = configScene()?.actor?.[layout];
          if (!current || !position) return;
          const height = Math.max(10, Math.min(100, Math.round(position.height * desired / current)));
          saved(prologueSettingKey(['scenes', selected, 'actor', layout, 'height']), height);
          placePrologueCharacter(actor, { ...position, height });
          syncField(prologueSettingKey(['scenes', selected, 'actor', layout, 'height']), height);
          alignTransformBox(); schedulePreview();
        });
        widthControl.append(widthLabel, widthInput, element('small', '', 'The figure keeps its proportions; editing width changes the shared height scale. Values are relative to the artwork frame.'));
        fields.append(addNumericControls(widthControl, widthRow, widthInput));
        alignTransformBox();
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
      if (scope === 'scene' && group === 'Picture & frame') {
        fields.prepend(element('p', 'pse-group-help', 'Drag the painting in the preview to change its X and Y focus. Turn on Grid to see guides; Snap aligns drags to the chosen spacing. Zoom the artwork to pan along an uncropped edge.'));
      }
    }
  };
  modeButton.addEventListener('click', () => { scope = scope === 'scene' ? 'defaults' : 'scene'; drawFields(); });
  sceneInput.addEventListener('change', () => { selected = sceneInput.value; scope = 'scene'; group = 'Words & artwork'; projectStatus.textContent = ''; drawFields(); preview(); });
  pathInput.addEventListener('change', () => { path = pathInput.value; preview(); });
  classInput.addEventListener('change', () => { drawFields(); preview(); });
  layoutInput.addEventListener('change', () => { layout = layoutInput.value; drawFields(); preview(); });
  drawFields(); preview();
  return door;
}
