#!/usr/bin/env node
// Card generator CLI (owner, 2026-11-21): prints generated card definitions of a target combat power as JSON.
//
//   node tools/generate-cards.mjs --rarity uncommon --rank 2 --count 5 --seed 7 [--type attack|skill] [--camp physical|spell] [--cls colorless] [--cp N]
//
// Card i uses seed (seed + i), so ids are gen.7 .. gen.11 above. Nothing is written; the cards are not in any reward pool.
import { GenerateCard } from '../src/model/cardGenerator.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : fallback; };
const count = Number(opt('count', 1)), seed = Number(opt('seed', 1));
const target = { rarity: opt('rarity', 'common'), type: opt('type', 'attack'), camp: opt('camp', 'physical'), cls: opt('cls', 'colorless') };
if (opt('cp') !== undefined) target.combatPower = Number(opt('cp'));
else if (opt('rank') !== undefined) target.rank = Number(opt('rank'));
const cards = [];
try {
  for (let i = 0; i < count; i++) cards.push(GenerateCard({ ...target, seed: seed + i }));
} catch (error) { console.error(`generate-cards: ${error.message}`); process.exit(1); }
console.log(JSON.stringify(cards, null, 2));
