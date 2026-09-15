// src/ui/models/DialogueModel.js — W4c dialogue (WGQ0–WGQ8), DOM-free.
//
// A quest exchange is spoken (proposal §7.5): the event's text divides into
// beats on blank lines, the player stands left and the speaker right, the
// caption region carries the current beat, and the responses are the event's
// own choices, offered on the last beat only.
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
import { wireframeUi } from '../../content/wireframeUi.js';

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

const positive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`dialogue.${name} must be a finite number > 0, got ${value}`);
  return value;
};

/**
 * dialogueFrameVars(config) → CSS custom properties the adapter writes.
 * The portrait share is a share of the scene's width; heights are reference
 * rems so the caption keeps its lines at every text size.
 */
export function dialogueFrameVars(config = wireframeUi.dialogue) {
  const share = positive(config.portraitShare, 'portraitShare');
  if (share > 0.5) throw new Error('dialogue.portraitShare cannot exceed half the scene: two portraits share it');
  const lines = config.captionLines;
  if (!Number.isInteger(lines) || lines < 1) throw new Error(`dialogue.captionLines must be a whole number ≥ 1, got ${lines}`);
  const lineHeight = positive(config.captionLineHeight, 'captionLineHeight');
  const sceneMin = positive(config.sceneMinRem, 'sceneMinRem');
  const round = (value) => Number(value.toFixed(4));
  return Object.freeze({
    '--dialogue-ref-rem': REFERENCE_REM,
    '--dialogue-portrait-share': `${round(share * 100)}%`,
    '--dialogue-scene-min': `calc(${round(sceneMin)} * ${REFERENCE_REM})`,
    '--dialogue-caption-line': `calc(${round(lineHeight)} * ${REFERENCE_REM})`,
    '--dialogue-caption-min': `calc(${round(lines * lineHeight)} * ${REFERENCE_REM})`,
  });
}
