// src/ui/models/DialogueModel.js — W4c dialogue (WGQ0–WGQ8), DOM-free.
//
// A quest exchange is spoken (proposal §7.5): the event's text divides into
// beats on blank lines, the player stands left and the speaker right, the
// caption region carries the current beat, and the responses are the event's
// own choices, offered on the last beat only. Its frame is the W4 parent
// combat uses (owner, 2026-09-15): the same four bands, with W4c's shares.
//
// NOTHING BUT A RESPONSE ISSUES A COMMAND. Back, Continue, Skip speech and
// speech ending move the presentation between beats and change nothing else;
// a response on the last beat is the one action that leaves this file as a
// command, and the screen hands that command to the quest door
// (engine/quests.js commitEventChoice). Reviewing earlier beats can never
// grant an effect again because no beat move produces a command at all.
//
// Only committed choices persist. This state is never saved, so loading
// mid-exchange reopens the exchange at its first beat.
import { allocateSceneBands } from './CombatLayout.js';

/** Every action the dialogue understands; anything else is a defect. */
export const DIALOGUE_ACTIONS = Object.freeze(['back', 'continue', 'skipSpeech', 'speechEnded', 'respond', 'resolved']);

// The reference rem: at least 16 physical px, or the root font when larger
// (the root is 10 px, so 1rem alone would be too small under zoom).
const REFERENCE_REM = 'max(16px / var(--ui-zoom, 1), 1rem)';

const frozenRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

/** dialogueBeats(text) → the event text split on blank lines, whitespace folded. */
export function dialogueBeats(text) {
  const beats = String(text ?? '')
    .split(/\n[ \t]*\n/)
    .map((beat) => beat.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return Object.freeze(beats.length ? beats : ['']);
}

/** The presentation state an exchange opens in: first beat, nothing taken. */
export function createDialogueState() {
  return Object.freeze({ beat: 0, generation: 0, resolved: false, choiceId: null, resultText: '' });
}

/**
 * dialogueModel(input, state) → the immutable view record.
 *
 * input: { eventId, title, text, speaker: { id, name, portraitKey },
 *          portraitAvailable, responses: [{ choiceId, label, affordable,
 *          binding, resultText }] } — `responses` are the choices the run can
 *          see (availableEventChoices), in authored order.
 * `portraitAvailable` is the screen's answer to "does art exist for this
 * key"; without it the portrait is the speaker's name plate, never a blank.
 */
export function dialogueModel({ eventId, title = '', text = '', speaker, portraitAvailable = false, responses = [] } = {}, state = createDialogueState()) {
  if (!speaker || typeof speaker.name !== 'string' || !speaker.name) {
    throw new Error(`dialogue '${eventId}' needs a named speaker`);
  }
  const beats = dialogueBeats(text);
  const last = beats.length - 1;
  const beat = Math.min(Math.max(Number.isInteger(state.beat) ? state.beat : 0, 0), last);
  const resolved = !!state.resolved;
  const onLast = beat === last;
  const portrait = portraitAvailable && speaker.portraitKey
    ? Object.freeze({ kind: 'art', key: String(speaker.portraitKey), name: speaker.name })
    : Object.freeze({ kind: 'plate', key: null, name: speaker.name });
  const offered = onLast && !resolved
    ? frozenRows(responses.map((response) => ({
      choiceId: String(response.choiceId),
      label: String(response.label ?? ''),
      affordable: response.affordable !== false,
      binding: !!response.binding,
      resultText: String(response.resultText ?? ''),
    })))
    : Object.freeze([]);
  return Object.freeze({
    eventId,
    title,
    beat,
    total: beats.length,
    onLast,
    resolved,
    generation: state.generation,
    phase: resolved ? 'resolved' : onLast ? 'respond' : 'speaking',
    beats: frozenRows(beats.map((line, index) => ({ index, text: line, side: 'speaker', current: index === beat }))),
    player: Object.freeze({ side: 'left', speaking: resolved }),
    speaker: Object.freeze({ side: 'right', id: speaker.id ?? null, name: speaker.name, portrait, speaking: !resolved }),
    // Once answered, the caption is the response's own result, on the
    // player's side: the consequence of what you said.
    caption: resolved
      ? Object.freeze({ side: 'player', speakerName: null, text: state.resultText || '' })
      : Object.freeze({ side: 'speaker', speakerName: speaker.name, text: beats[beat] }),
    responses: offered,
    controls: Object.freeze({
      back: Object.freeze({ enabled: !resolved && beat > 0 }),
      skipSpeech: Object.freeze({ enabled: !resolved && !onLast }),
      // On the last unanswered beat Continue is closed: the responses are
      // the way on. Once answered it leaves the exchange.
      continue: Object.freeze({ enabled: resolved || !onLast, exits: resolved }),
    }),
  });
}

/**
 * dialogueStep(view, state, action) → { state, command, exit }.
 *
 * `view` is dialogueModel(input, state). `command` is null for every action
 * but an offered, affordable `respond`; `exit` is true only for Continue after
 * the response. `speechEnded` carries the generation it was started under: a
 * stale callback (the player moved on or skipped since) changes nothing, and a
 * current one may only advance prose — it never picks a response.
 */
export function dialogueStep(view, state, action = {}) {
  if (!DIALOGUE_ACTIONS.includes(action.type)) throw new Error(`Unknown dialogue action '${action.type}'`);
  const move = (beat) => Object.freeze({ ...state, beat, generation: state.generation + 1 });
  const only = (next = state) => Object.freeze({ state: next, command: null, exit: false });
  switch (action.type) {
    case 'back':
      return view.controls.back.enabled ? only(move(view.beat - 1)) : only();
    case 'continue':
      if (view.resolved) return Object.freeze({ state, command: null, exit: true });
      return view.controls.continue.enabled ? only(move(view.beat + 1)) : only();
    case 'skipSpeech':
      return view.controls.skipSpeech.enabled ? only(move(view.total - 1)) : only();
    case 'speechEnded':
      if (action.generation !== state.generation || view.resolved || view.onLast) return only();
      return only(move(view.beat + 1));
    case 'respond': {
      const response = view.responses.find((row) => row.choiceId === action.choiceId);
      if (!response || !response.affordable) return only();
      return Object.freeze({
        state,
        command: Object.freeze({ type: 'commitEventChoice', eventId: view.eventId, choiceId: response.choiceId }),
        exit: false,
      });
    }
    case 'resolved':
      // The door's receipt, after the command above succeeded.
      if (view.resolved) return only();
      return only(Object.freeze({
        ...state,
        resolved: true,
        choiceId: String(action.choiceId ?? ''),
        resultText: String(action.resultText ?? ''),
        generation: state.generation + 1,
      }));
    default:
      return only();
  }
}

// ---------------------------------------------------------------------------
// The frame. Every number comes from the W4c scene config (`layout`, the
// resolved uiConfig.scenes.w4c) and its W4 parent (`parent`,
// uiConfig.scenes.w4), which the caller hands in: these functions read no
// config of their own. Only unit math (÷ 100) and the reference rem live here.
// ---------------------------------------------------------------------------

const round = (value) => Number(value.toFixed(4));
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const PORTRAIT_LAYERS = Object.freeze(['playerPortrait', 'npcPortrait']);

// One percent of the W4 frame's width and height, in local px. The stage
// adapter (components/dialogueStage.js) measures the frame and writes them;
// the fallbacks undo the body zoom the way the frame's own height does.
const FRAME_VW = 'var(--w4-vw, calc(1vw / var(--ui-zoom, 1)))';
const FRAME_VH = 'var(--w4-vh, calc(1dvh / var(--ui-zoom, 1)))';

/**
 * dialogueStack(layout) → { order, z, portraitsZ, speakerLift }.
 * The stacking order is layering.layers sorted by z (owner, 2026-09-15:
 * skybox, floor, portraits, context, then HUD and footer). Inside the portrait
 * layer the speaker is lifted over the listener when layering.speakerAbove.
 */
export function dialogueStack(layout) {
  const layers = [...layout.layering.layers].sort((a, b) => a.z - b.z);
  const portraitZ = layers.filter((layer) => PORTRAIT_LAYERS.includes(layer.id)).map((layer) => layer.z);
  return Object.freeze({
    order: Object.freeze(layers.map((layer) => layer.id)),
    z: Object.freeze(Object.fromEntries(layers.map((layer) => [layer.id, layer.z]))),
    portraitsZ: portraitZ.length ? Math.max(...portraitZ) : null,
    speakerLift: layout.layering.speakerAbove ? 1 : 0,
  });
}

/**
 * dialogueLayers(layout, overrides, scene) → { [layerId]: boolean }.
 * layering.layers[].enabled with any overrides applied. The skybox and floor
 * are also the scene's own WGS6/WGS7 toggles (`scene`: wireframeUi.scene).
 */
export function dialogueLayers(layout, overrides = {}, scene = { skyline: true, floor: true }) {
  const declared = Object.fromEntries(layout.layering.layers.map((layer) => [layer.id, layer.enabled]));
  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(declared, name)) throw new Error(`Unknown dialogue layer '${name}'`);
  }
  const merged = { ...declared, ...overrides };
  for (const [name, value] of Object.entries(merged)) {
    if (typeof value !== 'boolean') throw new Error(`dialogue layer ${name} must be true or false, got ${value}`);
  }
  if (Object.hasOwn(merged, 'skybox')) merged.skybox = merged.skybox && !!scene.skyline;
  if (Object.hasOwn(merged, 'floor')) merged.floor = merged.floor && !!scene.floor;
  return Object.freeze(merged);
}

/**
 * dialogueSceneConfig(layout, parent, scene) → the scene-layer config the
 * plate is fitted with: `scene` (wireframeUi.scene) with the layout's floor
 * depth (sizing.floorPercent of the scene window is floor; W4c 60%, where
 * combat's battlefield keeps its own) and the parent's plate bleed.
 */
export function dialogueSceneConfig(layout, parent, scene) {
  return Object.freeze({
    ...scene,
    floorFraction: layout.sizing.floorPercent / 100,
    bleedFraction: parent?.layering?.plate?.bleedFraction ?? scene.bleedFraction,
  });
}

/**
 * dialogueEntrance(layout, { reducedMotion, replay }) → { animated, steps, readyAtMs }.
 * Each motion.entrance step fades its layers in from atMs over fadeMs, rising
 * riseVh. The footer's controls and the responses open at readyAtMs, the
 * latest step's end: derived, never stored. Reduced motion, or a remount of
 * an exchange already open (`replay: false`), shows every layer at once.
 */
export function dialogueEntrance(layout, { reducedMotion = false, replay = true } = {}) {
  const quiet = reducedMotion || !replay;
  const steps = (layout.motion?.entrance || []).map((step) => Object.freeze({
    layers: Object.freeze([...step.layers]),
    atMs: quiet ? 0 : step.atMs,
    fadeMs: quiet ? 0 : step.fadeMs,
    riseVh: quiet ? 0 : (step.riseVh ?? 0),
  }));
  return Object.freeze({
    animated: steps.some((step) => step.fadeMs > 0),
    steps: Object.freeze(steps),
    readyAtMs: steps.reduce((latest, step) => Math.max(latest, step.atMs + step.fadeMs), 0),
  });
}

/**
 * dialogueBands(frame, layout, parent) → the W4 parent's band plan with the
 * layout's shares (models/CombatLayout.js). The footer keeps the parent's
 * physical minimum and the scene absorbs the shortfall.
 * frame: { width, height, zoom, rem } in local px, as combat passes it.
 */
export function dialogueBands(frame, layout, parent) {
  return allocateSceneBands(frame, layout, parent, { label: 'dialogue' });
}

/** dialogueCompactHost(viewportWidth, parent) → the compact slot width applies. */
export function dialogueCompactHost(viewportWidth, parent) {
  return viewportWidth < parent.sizing.compactBelowPx;
}

/**
 * dialogueFooterPlan(layout) → the footer's actions in vw: each one share of
 * the width left after the two side insets and the gaps between actions.
 */
export function dialogueFooterPlan(layout) {
  const actions = layout.components.footer.actions;
  const { sideInsetVw, gapVw } = layout.positioning.footer;
  const count = actions.length;
  const actionWidthVw = (100 - sideInsetVw * 2 - gapVw * (count - 1)) / count;
  if (!(actionWidthVw > 0)) throw new Error('dialogue footer insets and gaps leave no room for its actions');
  return Object.freeze({ actions: Object.freeze([...actions]), count, insetVw: sideInsetVw, gapVw, actionWidthVw });
}

/** Where a response grid may sit in the context band. */
export const RESPONSE_PLACEMENTS = Object.freeze(['below', 'beside']);

/**
 * dialogueResponsePlan(layout, count) → { count, maxVisible, visible, scrolls, candidates }.
 * behavior.maxVisibleResponses of the offered responses must show without
 * scrolling; only more than that may scroll the band. behavior.responseLayouts
 * lists the grids to try, in order (columns, and whether the grid sits below
 * the text or beside it, taking what textShare leaves); the stage adapter uses
 * the first one that measures as holding the visible responses.
 */
export function dialogueResponsePlan(layout, count) {
  const { maxVisibleResponses: maxVisible, responseLayouts } = layout.behavior || {};
  if (!Number.isInteger(maxVisible) || maxVisible < 1) {
    throw new Error(`dialogue behavior.maxVisibleResponses must be a whole number ≥ 1, got ${maxVisible}`);
  }
  if (!Array.isArray(responseLayouts) || !responseLayouts.length) throw new Error('dialogue behavior.responseLayouts must list at least one layout');
  const offered = Math.max(0, Math.trunc(Number(count) || 0));
  const visible = Math.min(offered, maxVisible);
  const candidates = responseLayouts.map((candidate, index) => {
    if (!Number.isInteger(candidate.columns) || candidate.columns < 1) {
      throw new Error(`dialogue behavior.responseLayouts[${index}].columns must be a whole number ≥ 1, got ${candidate.columns}`);
    }
    if (!RESPONSE_PLACEMENTS.includes(candidate.placement)) {
      throw new Error(`dialogue behavior.responseLayouts[${index}].placement must be one of ${RESPONSE_PLACEMENTS.join(', ')}, got ${candidate.placement}`);
    }
    if (candidate.placement === 'beside' && !(candidate.textShare > 0 && candidate.textShare < 1)) {
      throw new Error(`dialogue behavior.responseLayouts[${index}].textShare must lie between 0 and 1, got ${candidate.textShare}`);
    }
    return Object.freeze({
      columns: candidate.columns, placement: candidate.placement,
      textShare: candidate.placement === 'beside' ? candidate.textShare : null,
      rows: Math.ceil(visible / candidate.columns),
    });
  });
  return Object.freeze({ count: offered, maxVisible, visible, scrolls: offered > maxVisible, candidates: Object.freeze(candidates) });
}

/**
 * dialogueFrameVars(layout, parent) → CSS custom properties the adapter writes.
 * Widths are shares of the W4 frame's width and heights of its height (the
 * layout's vw/vh), the caption keeps its lines in reference rems at every
 * text size, and each layer's stacking order is the layout's z.
 */
export function dialogueFrameVars(layout, parent) {
  const { sizing, positioning } = layout;
  const sum = Object.values(sizing.bands).reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 100) > 1e-9) throw new Error(`dialogue sizing.bands: bands must sum to 100 (got ${sum})`);
  const fraction = positioning.portraits.visibleFraction;
  if (!(fraction > 0) || fraction > 1) {
    throw new Error(`dialogue visibleFraction must satisfy 0 < f ≤ 1 (got ${fraction})`);
  }
  const lines = sizing.context.captionLines;
  if (!Number.isInteger(lines) || lines < 1) throw new Error(`dialogue sizing.context.captionLines must be a whole number ≥ 1, got ${lines}`);
  const lineHeight = sizing.context.captionLineHeight;
  if (!(lineHeight > 0)) throw new Error(`dialogue sizing.context.captionLineHeight must be > 0, got ${lineHeight}`);
  const responses = sizing.responses;
  if (!Number.isInteger(responses.maxLines) || responses.maxLines < 1) {
    throw new Error(`dialogue sizing.responses.maxLines must be a whole number ≥ 1, got ${responses.maxLines}`);
  }
  dialogueResponsePlan(layout, 0);
  const footer = dialogueFooterPlan(layout);
  const stack = dialogueStack(layout);
  const vw = (value) => `calc(${round(value)} * ${FRAME_VW})`;
  const vh = (value) => `calc(${round(value)} * ${FRAME_VH})`;
  const rem = (value) => `calc(${round(value)} * ${REFERENCE_REM})`;
  const text = sizing.context.textRem;
  return Object.freeze({
    '--dialogue-ref-rem': REFERENCE_REM,
    '--dialogue-inset-x': vw(positioning.portraitSlot.insetVw),
    '--dialogue-portrait-w': vw(sizing.portraitSlot.widthVw),
    '--dialogue-portrait-w-compact': vw(sizing.portraitSlot.compactWidthVw),
    '--dialogue-slot-top': vh(positioning.portraitSlot.topOffsetVh),
    '--dialogue-context-w': vw(sizing.context.widthVw),
    '--dialogue-context-inset-x': vw(positioning.context.insetVw),
    '--dialogue-context-inset-y': vh(positioning.context.insetVh),
    '--dialogue-foot-inset-x': vw(footer.insetVw),
    '--dialogue-foot-gap': vw(footer.gapVw),
    '--dialogue-action-h': `max(${vh(sizing.footer.heightVh)}, calc(${round(parent.sizing.minimums.targetPx)}px / var(--ui-zoom, 1)))`,
    '--dialogue-title-size': rem(sizing.context.titleRem),
    '--dialogue-title-line': String(sizing.context.titleLineHeight),
    '--dialogue-text-size': rem(text),
    '--dialogue-caption-line': rem(text * lineHeight),
    '--dialogue-caption-min': rem(lines * text * lineHeight),
    '--dialogue-context-pad': rem(sizing.context.paddingRem),
    '--dialogue-context-gap': rem(sizing.context.gapRem),
    '--dialogue-response-size': rem(responses.fontRem),
    '--dialogue-response-line': String(responses.lineHeight),
    '--dialogue-response-pad-block': rem(responses.paddingBlockRem),
    '--dialogue-response-pad-inline': rem(responses.paddingInlineRem),
    '--dialogue-response-gap': rem(responses.gapRem),
    '--dialogue-response-lines': String(responses.maxLines),
    '--dialogue-response-min-h': `calc(${round(parent.sizing.minimums.targetPx)}px / var(--ui-zoom, 1))`,
    ...Object.fromEntries(stack.order.map((id) => [`--dialogue-z-${kebab(id)}`, String(stack.z[id])])),
    '--dialogue-z-portraits': String(stack.portraitsZ),
    '--dialogue-speaker-lift': String(stack.speakerLift),
  });
}
