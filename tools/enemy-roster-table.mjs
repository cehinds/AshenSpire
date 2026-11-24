#!/usr/bin/env node
// tools/enemy-roster-table.mjs - read-only markdown roster of Core enemies (default: the 32 Codex enemies).
//
//   node tools/enemy-roster-table.mjs                 the 32 Codex ids
//   node tools/enemy-roster-table.mjs wyrmAspirant …  chosen ids (any Core enemy)
//
// Every column is read from committed data, nothing is invented here:
//   Tier, HP, SP, MP, Attributes, Equipment, Relics   games/ashenspire/derived/characters.json (the Core pools at the sheet's
//                                                    lowest level; HP is before the global x0.7 setting; SP and MP are the
//                                                    per-turn Stamina and the Mana pool)
//   Act(s)                                           the seats of the encounters that field the enemy
//                                                    (content/source/{weald,marches,reach}Encounters.json)
//   Trait                                            the enemy sheet: relic (name: text), firstCard opener, boss phases
//   Cards                                            games/ashenspire/packs/core/enemyCards.json via the sheet deck + reserve
//   Weak to                                          the sheet's behaviour.weaknesses
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(ROOT, 'games/ashenspire/packs/core');
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export const CODEX_IDS = [
  'brackenTusker', 'fenwickToad', 'reedpipePoacher', 'wickerTitheman',
  'siltCrownNewt', 'wickerHind', 'blackrushStork', 'pearlbackSnail', 'alderMaskHarvester', 'woundwoodTusker', 'mireProcessional',
  'quarryRam', 'tollgateHookman', 'waxsealBailiff', 'carrionHeadsman', 'knellcapSentinel',
  'pallidOathCamel', 'inkveilNautilus', 'mirrorFanAbbess', 'saltChoirWalrus', 'rimewheelPenitent', 'veiledJusticiar', 'sixleggedHearse',
  'kilnshellTortoise', 'slagtongImp', 'sootwingBat', 'brassThroatIbex', 'kilnbackTerrapin', 'slagwingHeron', 'ashSilkWeaver', 'ferrumVotary',
  'crucibleNewt',
];

const SEAT_ACT = { weald: 'Weald (act 1)', marches: 'Marches (act 2)', reach: 'Reach (act 3)' };
const SEAT_FILE = { weald: 'wealdEncounters.json', marches: 'marchesEncounters.json', reach: 'reachEncounters.json' };
const ATTR = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', wisdom: 'WIS', intelligence: 'INT' };
const STATUS = { weak: 'Weak', frail: 'Frail', bleed: 'Bleed', crimsonBlight: 'Crimson Blight', insanity: 'Insanity', frost: 'Frost', strength: 'Strength' };
const words = s => String(s).replace(/_/g, ' ');
const bare = tag => String(tag).slice(String(tag).indexOf(':') + 1);
const esc = s => String(s).replace(/\|/g, '\\|');

export function loadAll() {
  const encounters = Object.entries(SEAT_FILE).flatMap(([seat, file]) =>
    json(join(ROOT, 'content/source', file)).map(e => ({ ...e, fileSeat: seat })));
  return {
    derived: new Map(json(join(ROOT, 'games/ashenspire/derived/characters.json')).map(c => [c.id, c])),
    cards: new Map(json(join(CORE, 'enemyCards.json')).map(c => [c.id, c])),
    relics: new Map(json(join(CORE, 'enemyRelics.json')).map(r => [r.id, r])),
    encounters,
  };
}

const sheetOf = id => json(join(CORE, 'enemies', `${id}.json`));

// "Deal {damage} damage and {poiseDamage} Poise damage." -> "Deal 16 damage and 8 Poise damage."
function cardEffect(card) {
  const v = {};
  for (const e of card.effects || []) {
    if (e.op === 'damage') { v.damage = e.amount; if (e.hits) v.hits = e.hits; }
    else if (e.op === 'block') v.block = e.amount;
    else if (e.op === 'heal') v.heal = e.amount;
    else if (e.op === 'poiseDamage') v.poiseDamage = e.amount;
    else if (e.op === 'loseHp') v.loseHp = e.amount;
    else if (e.op === 'applyStatus') v[e.status] = e.stacks;
  }
  const text = String(card.textTemplate || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  // Status names read better with the stack count: "Apply 2 Frost to the enemy" is the template's own wording.
  return text.replace(/Apply (\d+) ([A-Za-z ]+?) to /g, (m, n, s) => `Apply ${n} ${STATUS[s] || s} to `);
}

const cost = c => `${c.staminaCost} SP${c.manaCost ? ` + ${c.manaCost} MP` : ''}`;

function weakness(w) { return `${w.to}${w.effect === 'damage' ? '' : ` (${w.effect}${w.amount ? ` ${w.amount}` : ''})`}`; }

export function actsOf(id, encounters) {
  const seats = new Set();
  for (const e of encounters) if (e.enemies.includes(id)) seats.add(e.seat || e.fileSeat);
  return ['weald', 'marches', 'reach'].filter(s => seats.has(s)).map(s => SEAT_ACT[s]);
}

export function rowFor(id, data) {
  const d = data.derived.get(id);
  if (!d) throw new Error(`${id}: not in games/ashenspire/derived/characters.json`);
  const sheet = sheetOf(id);
  const lines = [];
  // Trait: relic(s), opener, phases.
  const trait = [];
  for (const r of sheet.relics) {
    const relic = data.relics.get(bare(r.ref));
    if (relic) trait.push(`${words(relic.name)}: ${relic.text}`);
  }
  const first = sheet.behaviour.firstCard && data.cards.get(bare(sheet.behaviour.firstCard));
  if (first) trait.push(`Opener, ${words(first.name)}: starts the fight with it (${cardEffect(first)})`);
  for (const p of sheet.behaviour.phases || []) {
    const doing = (p.do || []).map(e => (e.op === 'applyStatus' ? `${e.target === 'self' ? 'self' : 'player'} +${e.stacks} ${STATUS[e.status] || e.status}` : e.op)).join(', ');
    const unlock = (p.unlockCards || []).map(c => words(data.cards.get(bare(c))?.name || bare(c))).join(', ');
    trait.push(`Phase below ${p.pct}% HP: ${[doing, unlock && `unlocks ${unlock}`].filter(Boolean).join('; ')}`);
  }
  // Cards, grouped by id with the copy count.
  const count = new Map();
  for (const c of sheet.deck) count.set(c, (count.get(c) || 0) + 1);
  const cards = [...count].map(([c, n]) => {
    const card = data.cards.get(bare(c));
    return `${words(card.name)} ${cost(card)}: ${cardEffect(card)}${n > 1 ? ` ×${n}` : ''}`;
  });
  for (const c of sheet.reserve) {
    const card = data.cards.get(bare(c));
    cards.push(`${words(card.name)} ${cost(card)}: ${cardEffect(card)} (reserve, phase unlock)`);
  }
  const attrs = (sheet.stats.attributePriority || []).map(a => `${ATTR[a]} ${d.attributes[a]?.total ?? '?'}`).join(' · ');
  const gear = (d.gear || []).map(g => words(g.name)).join(', ') || 'none';
  const hp = `${d.pools.hp} (Lv ${sheet.derived.levelRange})`;
  lines.push(id, d.tier, actsOf(id, data.encounters).join(', ') || 'none', hp, d.pools.mp, d.pools.sp, attrs, gear,
    trait.join('<br>') || 'none', cards.join('<br>'), (sheet.behaviour.weaknesses || []).map(weakness).join(', '));
  return { name: sheet.name, cells: [sheet.name, ...lines.slice(1)] };
}

export function rosterTable(ids = CODEX_IDS, data = loadAll()) {
  const head = ['Enemy', 'Tier', 'Act(s)', 'HP', 'MP', 'SP', 'Attributes', 'Equipment', 'Trait', 'Cards', 'Weak to'];
  const rows = ids.map(id => rowFor(id, data).cells);
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2);
  try { console.log(rosterTable(ids.length ? ids : CODEX_IDS)); }
  catch (e) { console.error(`enemy-roster-table: ${e.message}`); process.exit(1); }
}
