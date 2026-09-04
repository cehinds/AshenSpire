// src/ui/screens/gameover.js — YOU PERISHED / EMBER RESTORED (SPEC §7.4)
//
// THE RUN'S END IS A DECISION DOOR ON THE PAGE (kit §05 body C): Title·L and
// the ornament say what happened, a DetailCard says who and where, a StatStrip
// carries the numbers, a KitLine the final deck, and the ButtonRow the two
// ways on. `.stats-table` stays on the strip as the landmark
// tools/release-shots.mjs reads for `?shot=death`; it draws nothing.

import { resolveCard } from '../../model/registries.js';
import { sfx } from '../sfx.js';
import {
  el, pageDoor, decide, detailCard, statStrip, chip, kitLine, kitItem, eyebrow, titleS, button, buttonRow, statusText,
} from '../kit/index.js';

export function mountGameOver(app, { registries, game, victory, onTitle, onHistory, earned = [] }) {
  sfx.play(victory ? 'victory' : 'youDied');
  const name = (game.customization && game.customization.name) || 'Forsaken';
  const glyph = (game.customization && game.customization.glyph) || '';
  const floors = game.mapGraph ? ` / ${game.mapGraph.floors}` : '';

  const toTitle = button({ label: 'Return to title', weight: 'primary', id: 'to-title' });
  const toHistory = onHistory ? button({ label: 'Run history', id: 'to-history' }) : null;

  const deck = kitLine(game.deck.map((inst) => {
    const def = resolveCard(registries, inst);
    return kitItem({ glyph: inst.upgraded ? '✦' : '◆', name: def.name, attrs: { class: `mini${inst.upgraded ? ' upgraded' : ''}` } });
  }), { class: 'plain deck-strip' });

  const body = decide({
    title: victory ? 'Ember restored' : 'You perished',
    children: [
      detailCard({
        eyebrow: 'Forsaken',
        name: `${name} ${glyph}`.trim(),
        line: `Floor ${game.floor}${floors} · ${game.stats.fightsWon} fight${game.stats.fightsWon === 1 ? '' : 's'} won`,
        meta: `Seed ${game.seedString}`,
      }),
      statStrip([
        chip({ key: 'Damage dealt', value: game.stats.damageDealt }),
        chip({ key: 'Damage taken', value: game.stats.damageTaken }),
        chip({ key: 'Cinders', value: game.cinders }),
        chip({ key: 'Final HP', value: `${victory ? game.hp : 0} / ${game.maxHp}` }),
      ], { class: 'stats-table' }),
      earned.length ? el('div', { class: 'as-detailcard go-earned' }, [
        el('span', { class: 'dc-eyebrow', text: 'Earned' }),
        ...earned.map((u) => el('div', { class: 'dc-line' }, [u.name, ' ', statusText(u.kind)])),
      ]) : null,
      el('div', { class: 'set-section-head' }, [eyebrow('Final deck'), titleS(`${game.deck.length} card${game.deck.length === 1 ? '' : 's'}`, { tag: 'h3' })]),
      deck,
      buttonRow({ size: 'medium', buttons: [toHistory, toTitle] }),
    ],
  });
  if (!victory) body.querySelector('.as-title-l').dataset.tone = 'loss';

  const door = pageDoor({
    eyebrow: victory ? 'The climb' : 'The climb ends',
    title: victory ? 'Victory' : 'Defeat',
    size: 'md',
    body,
    className: 'gameover-door',
    attrs: { 'aria-label': victory ? 'Ember restored' : 'You perished' },
  });
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'screen gameover' }, door));

  toTitle.addEventListener('click', onTitle);
  if (toHistory) toHistory.addEventListener('click', onHistory);
  toTitle.focus({ preventScroll: true });
}
