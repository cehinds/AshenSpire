// src/ui/screens/dialogue.js — W4c, the quest dialogue screen (WGQ0–WGQ8).
//
// Every quest exchange is spoken (proposal §7.5). The event's own text is the
// speech, divided into beats; the player stands left (WGQ2) and the speaker
// right (WGQ3) in the scene (WGQ1); the caption and, on the last beat only,
// the responses fill the caption/choice region (WGQ4); Back, Skip speech and
// Continue (WGQ6–WGQ8) are the speech progression (WGQ5).
//
// This adapter owns lifecycle and markup only. DialogueModel decides what is
// shown and which action becomes a command; the one command, a response, goes
// through the quest door (engine/quests.js commitEventChoice), exactly as the
// Event screen's responses do, so a dialogue adds no second effect path. A
// binding response keeps the hold-to-confirm (the same beat armer and
// 'eventChoice' action the Event screen uses).
//
// Only committed choices persist: this screen's beat is never saved, so a
// reload reopens the exchange at its first beat. A run-HUD remount keeps the
// beat and the answered state, so a flask drunk after answering can never
// offer the responses a second time.
import { commitEventChoice, choiceAffordable } from '../../engine/quests.js';
import { eventChoicesWithHistory } from '../../content/events.js';
import { availableEventChoices } from '../../model/quests.js';
import { isBindingChoice } from '../../framework/confirmationRule.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { createDialogueState, dialogueModel, dialogueStep, dialogueFrameVars } from '../models/DialogueModel.js';
import { el, modalHead, modalFooter, button, choiceRow, prose } from '../kit/index.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { enemySprite, playerSprite } from '../assets.js';
import { esc } from '../components/tooltip.js';
import { isEngaged, focusFirst } from '../input.js';
import { t } from '../strings.js';

export function mountDialogue(app, options) {
  const { registries, run, meta, rng, eventId, onDone, hud = null, dialogueState = null } = options;
  const def = registries.events.get(eventId);
  const speaker = registries.speakers.get(registries.eventSpeakers[eventId]);
  // Art exists for the key when a shipped enemy answers to it; otherwise the
  // model hands back the name plate, never a blank.
  const portraitAvailable = !!speaker.portraitKey && registries.enemies.has(speaker.portraitKey);
  const arm = beatArmer(meta, registries);
  const disarmers = [];
  let state = dialogueState || createDialogueState();

  const responses = () => availableEventChoices(eventChoicesWithHistory(def), run).map(({ choice }) => ({
    choiceId: choice.id,
    label: choice.label,
    affordable: choiceAffordable(choice, run),
    binding: isBindingChoice(choice, registries),
    resultText: choice.resultText,
  }));
  const view = () => dialogueModel({
    eventId, title: def.name, text: def.text, speaker, portraitAvailable, responses: responses(),
  }, state);
  const first = view();

  app.innerHTML = '';
  if (hud) app.insertAdjacentHTML('afterbegin', runHudHtml({ registries, run, meta, place: 'event', headerClass: 'map-header room-header' }));
  const screen = el('div', { class: 'screen dialogue-screen room-screen' });
  for (const [name, value] of Object.entries(dialogueFrameVars())) screen.style.setProperty(name, value);

  const status = el('span', { class: 'as-status modal-head-status dialogue-status', dataset: { dialogueStatus: '' } });
  const head = modalHead({ eyebrow: t('dialogue.eyebrow'), title: def.name, extras: status });
  // A decision has no way out but a response: no close control.
  head.querySelector('.modal-close')?.remove();

  const playerSlot = el('figure', { class: 'dialogue-portrait', dataset: { side: first.player.side, wireframe: 'WGQ2' } }, [
    el('div', { class: 'dialogue-portrait-art' }, playerSprite(run.customization || {}, run.class)),
    el('figcaption', { class: 'dialogue-portrait-name', text: t('dialogue.player') }),
  ]);
  const speakerArt = first.speaker.portrait.kind === 'art'
    ? enemySprite(registries.enemies.get(first.speaker.portrait.key))
    : el('div', { class: 'dialogue-plate', text: first.speaker.portrait.name });
  const speakerSlot = el('figure', {
    class: 'dialogue-portrait',
    dataset: { side: first.speaker.side, wireframe: 'WGQ3', portrait: first.speaker.portrait.kind },
  }, [
    el('div', { class: 'dialogue-portrait-art' }, speakerArt),
    el('figcaption', { class: 'dialogue-portrait-name', text: speaker.name }),
  ]);
  const scene = el('div', { class: 'dialogue-scene', dataset: { wireframe: 'WGQ1' } }, [playerSlot, speakerSlot]);

  const captionName = el('p', { class: 'as-eyebrow dialogue-caption-speaker' });
  const captionText = prose('', { class: 'dialogue-caption-text', 'aria-live': 'polite' });
  const responseBox = el('div', { class: 'dialogue-responses' });
  const region = el('div', { class: 'dialogue-region', dataset: { wireframe: 'WGQ4' } }, [captionName, captionText, responseBox]);

  const back = button({ label: t('dialogue.back'), id: 'dialogue-back', attrs: { dataset: { wireframe: 'WGQ6' } } });
  const skip = button({ label: t('dialogue.skip'), id: 'dialogue-skip', attrs: { dataset: { wireframe: 'WGQ7' } } });
  const cont = button({ label: t('dialogue.continue'), weight: 'primary', id: 'dialogue-continue', attrs: { dataset: { wireframe: 'WGQ8' } } });
  const foot = modalFooter({ secondary: [back, skip], primary: cont, size: 'fill', className: 'dialogue-foot' });
  foot.dataset.wireframe = 'WGQ5';

  const door = el('section', {
    class: 'modal dialogue-door', role: 'region',
    'aria-label': t('dialogue.region', { speaker: speaker.name }),
    dataset: { wireframe: 'WGQ0', eventId },
  }, [head, el('div', { class: 'modal-body dialogue-body' }, [scene, region]), foot]);
  screen.appendChild(door);
  app.appendChild(screen);
  if (hud) wireRunHud(app, { ...hud, registries, run, meta, remount: () => mountDialogue(app, { ...options, dialogueState: state }) });

  function teardown() {
    // A hold owns a window-level Escape listener; drop every one before its
    // button leaves the page (the #22 leak the Event screen guards too).
    while (disarmers.length) disarmers.pop()();
  }

  function dispatch(action) {
    const step = dialogueStep(view(), state, action);
    state = step.state;
    if (step.exit) {
      teardown();
      onDone();
      return;
    }
    if (step.command) {
      const receipt = commitEventChoice({ run, registries, rng }, step.command);
      state = dialogueStep(view(), state, { type: 'resolved', choiceId: receipt.choice.id, resultText: receipt.choice.resultText }).state;
    }
    render();
  }

  function responseButton(response) {
    const btn = button({ label: response.label, className: 'dialogue-response', disabled: !response.affordable });
    btn.dataset.choice = response.choiceId;
    if (response.binding) btn.dataset.binding = '1';
    if (!response.affordable) {
      btn.dataset.requires = '1';
      btn.appendChild(el('span', { class: 'dialogue-response-note', text: t('dialogue.cannotAfford') }));
      return btn;
    }
    disarmers.push(arm(btn, 'eventChoice', {
      ctx: { binding: response.binding },
      question: t('dialogue.respond.question', { label: response.label }),
      detailHtml: response.resultText ? `<p>${esc(response.resultText)}</p>` : '',
      confirmLabel: t('dialogue.respond.confirm'),
      onConfirm: () => dispatch({ type: 'respond', choiceId: response.choiceId }),
    }));
    return btn;
  }

  function render() {
    const v = view();
    teardown();
    status.textContent = v.phase === 'resolved' ? t('dialogue.status.resolved')
      : v.phase === 'respond' ? t('dialogue.status.respond')
      : t('dialogue.status.speaking', { beat: v.beat + 1, total: v.total });
    playerSlot.dataset.speaking = String(v.player.speaking);
    speakerSlot.dataset.speaking = String(v.speaker.speaking);
    region.dataset.side = v.caption.side;
    captionName.textContent = v.caption.speakerName || '';
    captionName.hidden = !v.caption.speakerName;
    captionText.textContent = v.caption.text;
    // Each response is its own WCB0 choice group at the full preset, so the
    // responses stack at one width whatever their labels say.
    responseBox.replaceChildren(...v.responses.map((response) => choiceRow({
      buttons: [responseButton(response)], size: 'full-standard', className: 'dialogue-response-row',
    })));
    back.disabled = !v.controls.back.enabled;
    skip.disabled = !v.controls.skipSpeech.enabled;
    cont.disabled = !v.controls.continue.enabled;
    cont.textContent = !v.resolved ? t('dialogue.continue')
      : run.combatEntered ? t('dialogue.continue.combat') : t('dialogue.continue.done');
    if (isEngaged()) {
      const target = v.responses.length ? '.dialogue-responses button:not([disabled])' : '.dialogue-foot button:not([disabled])';
      setTimeout(() => focusFirst(target), 0);
    }
  }

  back.addEventListener('click', () => { if (!back.disabled) dispatch({ type: 'back' }); });
  skip.addEventListener('click', () => { if (!skip.disabled) dispatch({ type: 'skipSpeech' }); });
  cont.addEventListener('click', () => { if (!cont.disabled) dispatch({ type: 'continue' }); });
  render();

  // Voice, when it comes, reports the end of a beat's speech here with the
  // generation it started under; the model decides whether that may advance
  // the prose, and it never picks a response.
  return {
    speechEnded: (generation) => dispatch({ type: 'speechEnded', generation }),
    generation: () => state.generation,
  };
}
