// src/ui/components/chestOption.js — what one elite-chest option reads as
// (SPEC §3.8.1): its category word, a glyph, a name and the sentence of what
// taking it does (HTML, every sentence a uiStrings row). One home for the solo
// reward screen and the co-op door, so the two never word a chest differently.

import { esc } from './tooltip.js';
import { relicText } from './card.js';
import { modEffectLines } from '../../model/loadout.js';
import { t } from '../strings.js';

export function chestOptionView(registries, option) {
  switch (option && option.category) {
    case 'relic': {
      const def = registries.relics.get(option.relicId);
      return { label: t('reward.chest.cat.relic'), glyph: def.icon || '◆', name: def.name, text: esc(relicText(def, registries)) };
    }
    case 'upgrade': {
      const def = registries.cards.get(option.cardId);
      const upgraded = (def.upgrade && def.upgrade.name) || `${def.name}+`;
      return {
        label: t('reward.chest.cat.upgrade'), glyph: '✚', name: upgraded,
        text: option.mode === 'owned'
          ? t('reward.chest.upgrade.owned', { name: esc(def.name), upgraded: esc(upgraded) })
          : t('reward.chest.upgrade.rare', { name: esc(upgraded) }),
      };
    }
    case 'armament': {
      if (option.weaponArtId) {
        const def = registries.cards.get(option.weaponArtId);
        return { label: t('reward.chest.cat.weaponArt'), glyph: '✦', name: def.name, text: t('reward.chest.weaponArt', { name: esc(def.name) }) };
      }
      const a = (registries.equipment.armaments || []).find((x) => x.id === option.armamentId);
      const effects = modEffectLines(registries, a).join(', ');
      return { label: t('reward.chest.cat.armament'), glyph: '⚔', name: a ? a.name : option.armamentId, text: esc(effects || t('reward.armament.plain')) };
    }
    case 'cinders':
      return {
        label: t('reward.chest.cat.cinders'), glyph: '◉', name: t('reward.chest.purseName', { cinders: option.cinders }),
        text: t('reward.chest.purse', { cinders: option.cinders, stones: option.smithingStones, plural: option.smithingStones === 1 ? '' : 's' }),
      };
    default:
      return { label: '', glyph: '?', name: String(option && option.category), text: '' };
  }
}
