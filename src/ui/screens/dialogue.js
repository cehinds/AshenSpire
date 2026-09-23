// src/ui/screens/dialogue.js — W4c, the quest dialogue screen (WGQ0–WGQ8).
//
// Every quest exchange is spoken (proposal §7.5). The event's own text is the
// speech, divided into beats. The screen is a child of the W4 parent combat
// uses (owner, 2026-09-15): the HUD band, the scene band, the context band and
// the footer band. The environment plate, skybox (WGS6) over floor (WGS7), is
// the base of the whole frame. The player (WGQ2) stands left and the speaker
// (WGQ3) right in the scene (WGQ1), each the whole figure zoomed so its top
// third meets the context band; that opaque band, the footer and the frame
// edge cut the rest. The caption and, on the last beat only, the responses
// fill the context (WGQ4); Back, Skip speech and Continue (WGQ6–WGQ8) are the
// footer's speech progression (WGQ5).
//
// This adapter owns lifecycle and markup only. DialogueModel decides what is
// shown, which layers draw, how the exchange enters and which action becomes
// a command; components/dialogueStage.js places the bands, the plate and the
// figures. The one command, a response, goes through the quest door
// (engine/quests.js commitEventChoice), exactly as the Event screen's
// responses do, so a dialogue adds no second effect path. A binding response
// keeps the hold-to-confirm (the same beat armer and 'eventChoice' action the
// Event screen uses).
//
// Only committed choices persist: this screen's beat is never saved, so a
// reload reopens the exchange at its first beat. A run-HUD remount keeps the
// beat and the answered state, so a flask drunk after answering can never
// offer the responses a second time, and it does not replay the entrance.
import { commitEventChoice, choiceAffordable } from '../../engine/quests.js';
import { eventChoicesWithHistory } from '../../content/events.js';
import { availableEventChoices } from '../../model/quests.js';
import { figureSpec } from '../../model/loadout.js';
import { isBindingChoice } from '../../framework/confirmationRule.js';
import { beatArmer } from '../../framework/optionDecision.js';
import {
  createDialogueState, dialogueModel, dialogueStep, dialogueFrameVars, dialogueLayers, dialogueEntrance, dialogueFooterPlan,
} from '../models/DialogueModel.js';
import { w4Parent, w4cLayout } from '../sceneConfig.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { el, modalFooter, button, prose } from '../kit/index.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { combatBackdropHtml } from '../components/environmentArt.js';
import { wireDialogueStage } from '../components/dialogueStage.js';
import { enemySprite, playerSprite } from '../assets.js';
import { reducedMotionRequested } from '../motion.js';
import { esc } from '../components/tooltip.js';
import { isEngaged, focusFirst } from '../input.js';
import { t } from '../strings.js';

const layerAttr = (name) => `layer${name[0].toUpperCase()}${name.slice(1)}`;

export function mountDialogue(app, options) {
  const {
    registries, run, meta, rng, eventId, onDone, hud = null, dialogueState = null,
    entrancePlayed = false, layers: layerOverrides = {},
  } = options;
  const def = options.definition || registries.events.get(eventId);
  const speaker = options.speaker || registries.speakers.get(registries.eventSpeakers[eventId]);
  // Art exists for the key when a shipped enemy answers to it; otherwise the
  // model hands back the name plate, never a blank.
  const portraitAvailable = !!speaker.portraitKey && registries.enemies.has(speaker.portraitKey);
  const arm = beatArmer(meta, registries);
  const disarmers = [];
  // Every number and switch below is the W4c scene config (uiConfig.scenes.w4c)
  // and its W4 parent; the models take both as parameters.
  const layout = w4cLayout();
  const parent = w4Parent();
  const layers = dialogueLayers(layout, layerOverrides, wireframeUi.scene);
  const entrance = dialogueEntrance(layout, { reducedMotion: reducedMotionRequested(), replay: !entrancePlayed });
  let entered = !entrance.animated;
  let entranceTimer = 0;
  let state = dialogueState || createDialogueState();

  const responses = () => availableEventChoices(options.definition ? def.choices : eventChoicesWithHistory(def), run).map(({ choice }) => ({
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
  // WGQ0: the W4 frame. No modal door, no close control: the HUD band is the
  // header and a decision has no way out but a response.
  const root = el('div', {
    class: 'w4-frame dialogue-screen', role: 'region',
    'aria-label': t('dialogue.region', { speaker: speaker.name }),
    dataset: { w4: 'dialogue', wireframe: 'WGQ0', eventId, entrance: entered ? 'done' : 'playing' },
  });
  for (const [name, value] of Object.entries(dialogueFrameVars(layout, parent))) root.style.setProperty(name, value);
  for (const [name, on] of Object.entries(layers)) root.dataset[layerAttr(name)] = on ? 'on' : 'off';
  root.dataset.mirrorNpc = String(layout.positioning.portraits.mirrorNpc !== false);

  // L6 HUD: the same shell as combat (hudShellHtml through runHudHtml) in the
  // W4 frame's first band, dressed as combat's is: no map/room header class,
  // whose wrapping rows would spill out of a 10vh band.
  const hudShown = !!hud && layers.hud;
  if (hudShown) root.insertAdjacentHTML('afterbegin', runHudHtml({ registries, run, meta, place: 'event', headerClass: '' }));

  // L2 skybox and L3 floor: the combat environment plate, twice, cut at the
  // floor line (dialogueStage fits both to the scene window).
  const plateLayer = (layer, wireframe) => {
    const wrap = el('div', { class: `dialogue-plate-layer dialogue-${layer}`, 'aria-hidden': 'true', dataset: { layer, wireframe } });
    wrap.innerHTML = combatBackdropHtml(run);
    wrap.hidden = !layers[layer];
    return wrap;
  };
  const skybox = plateLayer('skybox', 'WGS6');
  const floor = plateLayer('floor', 'WGS7');
  // WGQ1: the scene window between the HUD and the context. It draws nothing
  // itself; the plate and the figures are measured against it.
  const sceneWindow = el('div', { class: 'dialogue-scene', 'aria-hidden': 'true', dataset: { wireframe: 'WGQ1' } });

  // L4 portraits: the whole figure, placed by dialogueStage. A speaker with no
  // art keeps its name plate in the slot, on the reveal line.
  const portrait = ({ side, wireframe, layer, kind, art, name }) => {
    if (art) art.classList.add('dialogue-figure');
    return el('figure', {
      class: 'dialogue-portrait',
      dataset: { side, wireframe, layer, portrait: kind, figureFit: art ? 'pending' : 'none' },
      hidden: !layers[layer],
    }, [
      el('div', { class: 'dialogue-portrait-art' }, art ? [art] : []),
      el('div', { class: 'dialogue-portrait-slot' }, [
        kind === 'plate' ? el('div', { class: 'dialogue-plate', text: name }) : null,
        el('figcaption', { class: 'dialogue-portrait-name', text: name }),
      ].filter(Boolean)),
    ]);
  };
  const figure = figureSpec(registries, run.loadout, run.class);
  const playerSlot = portrait({
    side: first.player.side, wireframe: 'WGQ2', layer: 'playerPortrait', kind: 'art',
    art: playerSprite(run.customization || {}, run.class, figure.armourId, { animation: equipmentAnimationForLoadout(registries, run.loadout, run.class), view: 'conversation' }), name: t('dialogue.player'),
  });
  const speakerSlot = portrait({
    side: first.speaker.side, wireframe: 'WGQ3', layer: 'npcPortrait', kind: first.speaker.portrait.kind,
    // enemySprite faces its art toward the player (assets.spriteMirror).
    art: first.speaker.portrait.kind === 'art' ? enemySprite(registries.enemies.get(first.speaker.portrait.key)) : null,
    name: speaker.name,
  });
  const portraits = el('div', { class: 'dialogue-portraits', dataset: { layer: 'portraits' } }, [playerSlot, speakerSlot]);

  // L5 context (WGQ4): the quest's title on one line, the narrative beat and,
  // on the last beat only, the responses. Owner, 2026-09-15: no sub-headings
  // on the band (the speaker is named under the portrait), so the "Quest"
  // eyebrow, the speaker line and the progress hint are read to screen
  // readers only. Up to behavior.maxVisibleResponses responses show without
  // scrolling; the band scrolls inside only past that, and the page never.
  const eyebrow = el('p', { class: 'sr-only dialogue-eyebrow', text: t('dialogue.eyebrow') });
  const titleLine = el('h2', { class: 'dialogue-title', title: def.name, text: def.name });
  const status = el('span', { class: 'sr-only dialogue-status', role: 'status', dataset: { dialogueStatus: '' } });
  const captionName = el('p', { class: 'sr-only dialogue-caption-speaker' });
  const captionText = prose('', { class: 'dialogue-caption-text', 'aria-live': 'polite' });
  const responseBox = el('div', { class: 'dialogue-responses', role: 'group' });
  const region = el('div', { class: 'dialogue-region' }, [eyebrow, titleLine, captionName, captionText, responseBox, status]);
  const context = el('section', { class: 'dialogue-context', dataset: { wireframe: 'WGQ4', layer: 'context' }, hidden: !layers.context }, [region]);

  // L6 footer (WGQ5): the three-action variant, WCB0 equal shares.
  const back = button({ label: t('dialogue.back'), id: 'dialogue-back', attrs: { dataset: { wireframe: 'WGQ6' } } });
  const skip = button({ label: t('dialogue.skip'), id: 'dialogue-skip', attrs: { dataset: { wireframe: 'WGQ7' } } });
  const cont = button({ label: t('dialogue.continue'), weight: 'primary', id: 'dialogue-continue', attrs: { dataset: { wireframe: 'WGQ8' } } });
  // The layout names the footer's actions in order; Continue is the way on.
  const controls = { back, skipSpeech: skip, continue: cont };
  const actions = dialogueFooterPlan(layout).actions;
  const foot = modalFooter({
    secondary: actions.filter((id) => id !== 'continue').map((id) => controls[id]),
    primary: actions.includes('continue') ? cont : null,
    size: 'fill', className: 'dialogue-foot',
  });
  foot.dataset.wireframe = 'WGQ5';
  foot.dataset.layer = 'footer';
  foot.hidden = !layers.footer;

  root.append(skybox, floor, sceneWindow, portraits, context, foot);
  app.appendChild(root);
  if (hudShown) {
    wireRunHud(app, {
      ...hud, registries, run, meta,
      remount: () => mountDialogue(app, { ...options, dialogueState: state, entrancePlayed: true }),
    });
  }
  const stage = wireDialogueStage(root, { layout, parent, scene: wireframeUi.scene });

  function teardown() {
    // A hold owns a window-level Escape listener; drop every one before its
    // button leaves the page (the #22 leak the Event screen guards too).
    while (disarmers.length) disarmers.pop()();
  }

  function dispatch(action) {
    if (!entered) return;
    const step = dialogueStep(view(), state, action);
    state = step.state;
    if (step.exit) {
      teardown();
      clearTimeout(entranceTimer);
      stage.release();
      onDone();
      return;
    }
    if (step.command) {
      const receipt = options.commitChoice ? options.commitChoice(step.command) : commitEventChoice({ run, registries, rng }, step.command);
      state = dialogueStep(view(), state, { type: 'resolved', choiceId: receipt.choice.id, resultText: receipt.choice.resultText }).state;
    }
    render();
  }

  function responseButton(response) {
    // Until the context has appeared a response is shown but not yet operable.
    // WCB0 full width of its grid cell; the label wraps inside the button to
    // sizing.responses.maxLines and the whole of it stays in the tooltip.
    // WCB0 full width of its grid cell; the label wraps to
    // sizing.responses.maxLines. With behavior.responseHints 'tooltip' the
    // face carries the answer and nothing else: why a response cannot be
    // taken, and that a binding one is held rather than tapped, are told in
    // the tooltip and to a screen reader, and the press still shows itself.
    const tooltipHints = layout.behavior.responseHints === 'tooltip';
    const btn = button({ label: '', className: 'dialogue-response', size: 'full-standard', disabled: !response.affordable || !entered });
    btn.title = response.label;
    btn.appendChild(el('span', { class: 'dialogue-response-label', text: response.label }));
    btn.dataset.choice = response.choiceId;
    if (response.binding) btn.dataset.binding = '1';
    if (!response.affordable) {
      btn.dataset.requires = '1';
      const reason = t('dialogue.cannotAfford');
      if (tooltipHints) {
        btn.title = `${response.label} — ${reason}`;
        btn.setAttribute('aria-description', reason);
      } else {
        btn.appendChild(el('span', { class: 'dialogue-response-note', text: reason }));
      }
      return btn;
    }
    if (!entered) return btn;
    if (tooltipHints && response.binding) {
      const held = t('dialogue.respond.hold');
      btn.title = `${response.label} — ${held}`;
      btn.setAttribute('aria-description', held);
    }
    disarmers.push(arm(btn, 'eventChoice', {
      ctx: { binding: response.binding },
      showHint: !tooltipHints,
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
    region.dataset.phase = v.phase;
    captionName.textContent = v.caption.speakerName || '';
    captionName.hidden = !v.caption.speakerName;
    captionText.textContent = v.caption.text;
    // The responses form one grid; the stage picks its columns and placement
    // so that up to behavior.maxVisibleResponses fit without scrolling.
    responseBox.replaceChildren(...v.responses.map(responseButton));
    stage.fitResponses();
    // The footer is drawn at t=0 but opens only when the context has appeared.
    back.disabled = !entered || !v.controls.back.enabled;
    skip.disabled = !entered || !v.controls.skipSpeech.enabled;
    cont.disabled = !entered || !v.controls.continue.enabled;
    cont.textContent = !v.resolved ? t('dialogue.continue')
      : run.combatEntered ? t('dialogue.continue.combat') : t('dialogue.continue.done');
    if (entered && isEngaged()) {
      const target = v.responses.length ? '.dialogue-responses button:not([disabled])' : '.dialogue-foot button:not([disabled])';
      setTimeout(() => focusFirst(target), 0);
    }
  }

  // The entrance (the layout's steps): a step with no fade is there at t=0;
  // the others fade their layers in from atMs, rising riseVh, toward what the
  // page already styles (a dimmed listener ends dimmed). The controls open
  // when the last step has appeared (DialogueModel.dialogueEntrance).
  const layerNodes = {
    skybox: [skybox], floor: [floor], hud: [...root.querySelectorAll(':scope > .topbar')], footer: [foot],
    playerPortrait: [playerSlot], npcPortrait: [speakerSlot], context: [context],
  };
  function playEntrance() {
    if (entered) return;
    const frameHeight = root.clientHeight;
    for (const step of entrance.steps) {
      if (!(step.fadeMs > 0)) continue;
      const rise = frameHeight * step.riseVh / 100;
      const from = rise ? { opacity: 0, transform: `translateY(${rise}px)` } : { opacity: 0 };
      for (const layer of step.layers) {
        for (const node of layerNodes[layer] || []) {
          node.animate([from], { duration: step.fadeMs, delay: step.atMs, fill: 'backwards', easing: 'ease-out' });
        }
      }
    }
    entranceTimer = setTimeout(() => {
      if (!root.isConnected) return;
      entered = true;
      root.dataset.entrance = 'done';
      render();
    }, entrance.readyAtMs);
  }

  back.addEventListener('click', () => { if (!back.disabled) dispatch({ type: 'back' }); });
  skip.addEventListener('click', () => { if (!skip.disabled) dispatch({ type: 'skipSpeech' }); });
  cont.addEventListener('click', () => { if (!cont.disabled) dispatch({ type: 'continue' }); });
  render();
  playEntrance();

  // Voice, when it comes, reports the end of a beat's speech here with the
  // generation it started under; the model decides whether that may advance
  // the prose, and it never picks a response.
  return {
    speechEnded: (generation) => dispatch({ type: 'speechEnded', generation }),
    generation: () => state.generation,
  };
}
import { equipmentAnimationForLoadout } from '../../model/equipmentAnimation.js';
