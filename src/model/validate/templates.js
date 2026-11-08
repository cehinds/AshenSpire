// src/model/validate/templates.js — text-template token checks for cards and relics (SPEC §3.13).
// Split out of validate.js.

import { nodeVariableBindings } from '../tree.js';
import { REQUIRED_TOKEN_OPS, relicModifierTokenBindings, computeTokenBindings, cardTokenEffects, extractTemplateTokens } from './tokenBindings.js';

export function checkTemplate(template, effects, path, err, extraBindings = []) {
  const bindings = [...computeTokenBindings(effects), ...extraBindings];
  const bound = new Set(bindings.map((bd) => bd.token));
  for (const token of extractTemplateTokens(template)) {
    if (!bound.has(token)) {
      err(path, `Template token '{${token}}' does not bind to any effect value`);
    }
  }
  const used = new Set(extractTemplateTokens(template));
  for (const bd of bindings) {
    if (bd.literal && (bd.required || REQUIRED_TOKEN_OPS.includes(bd.op)) && !used.has(bd.token)) {
      err(path, `Player-visible numeric effect (op '${bd.op}', token '{${bd.token}}') lacks a template token`);
    }
  }
}

// The Core wardOff face is a replacement text: every token must bind (or be {poiseDamage}); unlike the base face
// it need not mention every numeric effect, so only unknown tokens are errors.
function checkWardOffTemplate(card, path, err) {
  if (typeof card.wardOffTextTemplate !== 'string') return;
  const bound = new Set([...computeTokenBindings(cardTokenEffects(card)).map((bd) => bd.token), 'poiseDamage']);
  for (const token of extractTemplateTokens(card.wardOffTextTemplate)) {
    if (!bound.has(token)) err(`${path}.wardOffTextTemplate`, `Template token '{${token}}' does not bind to any effect value`);
  }
}

// A card's `faceTemplate` (SPEC card face rules): one to three lines of at most five words, tokens bound like textTemplate's,
// without the "every number is stated" rule (the face is a summary; Information carries the rest).
function checkFaceTemplate(card, path, err) {
  const sets = [[`${path}.faceTemplate`, card.faceTemplate, cardTokenEffects(card)]];
  if (card.upgrade?.effects) sets.push([`${path}.faceTemplate`, card.faceTemplate, cardTokenEffects({ effects: card.upgrade.effects, onTurnEndInHand: card.onTurnEndInHand })]);
  for (const profile of card.gradeProfiles || []) sets.push([`${path}.gradeProfiles.faceTemplate`, profile.faceTemplate ?? card.faceTemplate, cardTokenEffects({ effects: profile.effects, onTurnEndInHand: card.onTurnEndInHand })]);
  for (const [at, lines, effects] of sets) {
    if (lines === undefined) continue;
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 3) { err(at, 'must be one to three short lines'); continue; }
    const bound = new Set(computeTokenBindings(effects).map((bd) => bd.token));
    for (const line of lines) {
      if (typeof line !== 'string') { err(at, 'lines must be strings'); continue; }
      if (line.replace(/\{[^}]*\}/g, 'N').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length > 5) err(at, `'${line}' is longer than five words`);
      for (const token of extractTemplateTokens(line)) if (!bound.has(token)) err(at, `Face token '{${token}}' does not bind to any effect value`);
    }
  }
}

// A card's `ramp` (SPEC §4.3): per is a whole number 1..3; the stat must name an effect the card (or its upgrade) has.
export function validateCardRamp(card, path, err) {
  for (const [at, ramp, effects] of [[`${path}.ramp`, card.ramp, card.effects], [`${path}.upgrade.ramp`, card.upgrade?.ramp, card.upgrade?.effects ?? card.effects]]) {
    if (!ramp) continue;
    if (!Number.isInteger(ramp.per) || ramp.per < 1 || ramp.per > 3) err(`${at}.per`, 'must be a whole number from 1 to 3');
    const hit = (Array.isArray(effects) ? effects : []).find(effect => effect && effect.op === ramp.stat);
    if (!hit) err(`${at}.stat`, `no '${ramp.stat}' effect to ramp`);
    else if (!Number.isFinite(hit.amount)) err(`${at}.stat`, `the '${ramp.stat}' effect's amount must be a plain number to ramp`);
    else if (hit.hits !== undefined && hit.hits !== 1) err(`${at}.stat`, `the '${ramp.stat}' effect hits more than once; a ramp grows a single-hit effect only`);
  }
}

// A card's `contest` (SPEC §17 Contests): which attribute pair rolls it; the constants are data (mechanics.contest).
export function validateCardContest(card, path, err) {
  for (const [at, value] of [[`${path}.contest`, card.contest], [`${path}.upgrade.contest`, card.upgrade?.contest]]) {
    if (value !== undefined && !['mental', 'physical'].includes(value)) err(at, "must be 'mental' or 'physical'");
  }
}

export function validateCardTemplates(card, path, err) {
  if (typeof card.textTemplate !== 'string' || !Array.isArray(card.effects)) return; // schema pass reports
  checkTemplate(card.textTemplate, cardTokenEffects(card), `${path}.textTemplate`, err);
  checkWardOffTemplate(card, path, err);
  checkFaceTemplate(card, path, err);
  if (card.singleBreak) checkTemplate(card.singleBreak.textTemplate, cardTokenEffects(card.singleBreak), `${path}.singleBreak.textTemplate`, err);
  if (card.upgrade) {
    const upTemplate = card.upgrade.textTemplate != null ? card.upgrade.textTemplate : card.textTemplate;
    const upEffects = card.upgrade.effects != null ? card.upgrade.effects : card.effects;
    if (typeof upTemplate === 'string' && Array.isArray(upEffects)) {
      // The upgrade cannot override the in-hand hook, so it inherits the base's.
      checkTemplate(upTemplate, cardTokenEffects({ effects: upEffects, onTurnEndInHand: card.onTurnEndInHand }), `${path}.upgrade.textTemplate`, err);
    }
  }
}

export function validateRelicTemplate(relic, path, err, rulesByTag = null, taggingByObject = null, bundle = null) {
  if (typeof relic.textTemplate !== 'string') return;
  // A relic's sentence covers the whole relic, and since plan phase 2 the whole
  // relic is two homes: the passives it still owns, and the triggers that moved
  // into its property rules. Both are read here, so "every number a player sees
  // is derived from the entry that produces it" survives the move intact.
  const effects = [];
  for (const trig of relic.triggers || []) {
    if (trig && Array.isArray(trig.do)) effects.push(...trig.do);
  }
  // The rules' half binds BY NAME: one binding per variable the relic's nodes
  // declare (tree.js nodeVariableBindings), carrying the op that reads it so
  // the "every player-visible number is stated" rule below is asked of a
  // variable exactly as it was of an op position.
  const byName = [];
  for (const tag of (taggingByObject && taggingByObject.get(relic.id)) || []) byName.push(...nodeVariableBindings(bundle, tag));
  checkTemplate(relic.textTemplate, effects, `${path}.textTemplate`, err, [...relicModifierTokenBindings(relic), ...byName]);
}
