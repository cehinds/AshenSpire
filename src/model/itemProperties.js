// The properties the player's gear and relics hold, folded into one small object the fight and the deck editor read
// (W25 step 6). Pure and headless: it reads the run's loadout and relics and the data pool
// (content/source/itemProperties.json); the engine only reads the result, stamped onto the player as `itemProps`.
//
// Summary shape (every key absent when nothing sets it, so a run without properties yields {}):
//   handSize, retain, startBlock, poiseGuard, firstSkillDraw, stanceDraw, stanceStamina   whole numbers, summed
//   poiseDamagePct                  whole number, summed: Poise the player's hits remove from a target grows by this percent
//   minDeckDelta                    whole number, summed: the deck editor's minimum drops by this
//   weaponBonuses  [{ damageType, amount }]            a separate typed packet on every melee weapon attack
//   onHit          [{ status, stacks }]                statuses every attack applies to its target
//   stanceRating   { <stance>: { <rating>: n } }       a rating bonus while in a stance
//   resist         { <damageType>: 'resist'|'immune' } incoming damage of a type is halved or negated
//   statusShorten  { <status>: n }                     statuses applied to the player start n stacks smaller
//   unlimited      ['Basic'|'Cantrip']                 card kinds deck editing adds without limit
import { ITEM_PROPERTIES } from '../content/itemProperties.js';
import { ItemPropertyIds, ItemPicks } from './itemPicks.js';

const SUMMED = ['handSize', 'retain', 'startBlock', 'poiseGuard', 'firstSkillDraw', 'stanceDraw', 'stanceStamina', 'minDeckDelta'];

/** The item refs worn or held now: the active weapon / shield / armour slots, then every relic. */
export function HeldItemRefs(run) {
  const refs = [];
  for (const [slot, ids] of Object.entries(run?.loadout?.sets || {})) {
    const id = ids?.[run.loadout.active?.[slot] || 0];
    if (id) refs.push(slot === 'armor' ? `armor/${run.class}/${id}` : `armament/${id}`);
  }
  for (const id of run?.relics || []) refs.push(`relic/${id}`);
  return refs;
}

/** Fold the fx blocks of every held item's properties into one summary. */
export function ItemPropertySummary(run) {
  const out = {};
  const bump = (key, n) => { out[key] = (out[key] || 0) + n; };
  for (const ref of HeldItemRefs(run)) {
    // A Blacksmith pick that is not a stat: +10% Poise damage on a magic weapon.
    for (const pick of ItemPicks(run, ref)) if (pick.k === 'effect' && pick.effect === 'poiseDamagePct') bump('poiseDamagePct', pick.n);
    for (const id of ItemPropertyIds(run, ref)) {
      const fx = ITEM_PROPERTIES.find((row) => row.id === id)?.fx;
      if (!fx) continue;
      for (const key of SUMMED) if (Number.isFinite(fx[key])) bump(key, fx[key]);
      if (fx.weaponBonus) (out.weaponBonuses ||= []).push({ ...fx.weaponBonus });
      if (fx.onHit) (out.onHit ||= []).push({ ...fx.onHit });
      if (fx.stanceRating) {
        const { stance, rating, n } = fx.stanceRating;
        const row = ((out.stanceRating ||= {})[stance] ||= {});
        row[rating] = (row[rating] || 0) + n;
      }
      for (const [type, kind] of Object.entries(fx.resist || {})) {
        const map = (out.resist ||= {});
        if (map[type] !== 'immune') map[type] = kind;
      }
      for (const [status, n] of Object.entries(fx.statusShorten || {})) {
        const map = (out.statusShorten ||= {});
        map[status] = (map[status] || 0) + n;
      }
      if (fx.unlimited && !(out.unlimited || []).includes(fx.unlimited)) (out.unlimited ||= []).push(fx.unlimited);
    }
  }
  return out;
}

/** The card kinds ('Basic', 'Cantrip') the run's items let deck editing add without limit. */
export const ItemUnlimitedKinds = (run) => ItemPropertySummary(run).unlimited || [];

/** The deck editor's minimum drops by this many cards. */
export const ItemMinDeckDelta = (run) => ItemPropertySummary(run).minDeckDelta || 0;
