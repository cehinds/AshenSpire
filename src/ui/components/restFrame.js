// Shared Rest presentation: the full-game and configured services occupy the
// same painted room, HUD and two-column choice body.
import { runHudHtml, wireRunHud } from './runHud.js';
import { scenePainting } from './scenePainting.js';
import { mountChoiceBody } from './choiceBody.js';
import { t } from '../strings.js';

const bounded = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : fallback));
};

export function restPresentation(registries) {
  const authored = registries.balance?.ui?.shrinePresentation || {};
  return {
    optionLayout: authored.optionLayout === 'grid' ? 'grid' : 'list',
    style: `--shrine-folded-card-width:calc(${bounded(authored.foldedCardWidthViewportPct, 88, 60, 100)} * var(--view-vw, 1vw));--shrine-folded-card-max-width:${bounded(authored.foldedCardMaxWidthRem, 44, 24, 72)}rem;--shrine-folded-card-height:calc(${bounded(authored.foldedCardHeightViewportPct, 10, 6, 18)} * var(--view-vh, 1vh));--shrine-folded-card-max-height:${bounded(authored.foldedCardMaxHeightRem, 6.5, 4, 12)}rem`,
  };
}

export function mountRestFrame(app, { registries, run, meta, hud, eyebrow = t('rest.eyebrow'), title, status, choices, consequences, foot, remount }) {
  app.innerHTML = `${hud ? runHudHtml({ registries, run, meta, place: 'rest', headerClass: 'map-header room-header workspace-hud' }) : ''}
    <div class="screen room-screen rest-screen" style="${restPresentation(registries).style}"></div>`;
  const screen = app.querySelector('.rest-screen');
  screen.appendChild(scenePainting('rest'));
  mountChoiceBody(screen, { className: 'rest-door', eyebrow, title, status, choices, consequences, foot });
  if (hud) wireRunHud(app, { ...hud, registries, run, meta, remount });
  return screen;
}
