#!/usr/bin/env node
// Focused source door for issue #209. The selected standalone door is added
// only after the serialized #27 artifact rebuild releases root/build/dist.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createCoopCombat, leaveCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createMemoryStorage, createSaveManager, META_KEY } from '../src/engine/save.js';
import { createRegistries } from '../src/model/registries.js';
import { friendlyTargetMode, friendlyTargetPlan } from '../src/model/friendlyTargets.js';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { setCombatStartStateForTools } from './session.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const files = {
  model: 'src/model/friendlyTargets.js',
  shared: 'src/ui/components/friendlyTargets.js',
  combat: 'src/ui/screens/combat.js',
  coop: 'src/ui/screens/coop.js',
  input: 'src/ui/input.js',
  engine: 'src/engine/coopCombat.js',
  session: 'tools/session.mjs',
};

const source = Object.fromEntries(Object.entries(files).map(([key, rel]) => [key, fs.existsSync(path.join(ROOT, rel)) ? read(rel) : '']));
function evaluateSource(candidate) {
  return [
    ['headless semantics and UI renderer are split', /export function friendlyTargetPlan/.test(candidate.model) && /export function renderTargetSilhouette/.test(candidate.shared)],
    ['blue self and green ally stay distinct', /self: '#4d94e0'/.test(candidate.shared) && /ally: '#49b675'/.test(candidate.shared)],
    ['solo and co-op share the renderer', /from ['"]\.\.\/components\/friendlyTargets\.js['"]/.test(candidate.combat) && /from ['"]\.\.\/components\/friendlyTargets\.js['"]/.test(candidate.coop)],
    ['down and disconnected seats are excluded', /!player\.alive \|\| !player\.connected/.test(candidate.model)],
    ['co-op has relationship-specific targets', /data-friendly-target/.test(candidate.coop) && !/arming && p\.alive && p\.connected \? ' throw-target'/.test(candidate.coop)],
    ['co-op target cancel restores focus', /function cancelFriendlyTargeting[\s\S]{0,500}if \(card\) focusElement\(card\);/.test(candidate.coop) && /ev\.key === 'Escape'/.test(candidate.coop)],
    ['co-op legal targets enter the shared focus system', /decorateFriendlyTarget/.test(candidate.coop) && /dataset\.focusable/.test(candidate.shared) && /aria-label/.test(candidate.shared)],
    ['confirm disarms before its one network intent', /armedFriendlyCard = null;\r?\n\s+hideTooltip\(\);\r?\n\s+render\(\);\r?\n\s+send\(\{ t: 'playCard'/.test(candidate.coop)],
    ['server validates the same friendly target model before spending', /targetId = assertFriendlyTarget\(friendlyPlan, targetId, C\.playerKey\);/.test(candidate.engine) && candidate.engine.indexOf('targetId = assertFriendlyTarget') < candidate.engine.indexOf('p.energy -= cost')],
    ['all hostile target families outrank source-side friendly effects', /HOSTILE_TARGETS = new Set\(\['enemy', 'allEnemies', 'randomEnemy'\]\)/.test(candidate.model) && /HOSTILE_TARGETS\.has\(effect\.target\)/.test(candidate.model)],
    ['engine imports only the lower headless friendly-target model', /from ['"]\.\.\/model\/friendlyTargets\.js['"]/.test(candidate.engine) && !/import\s+(?:[^;]*\s+from\s+)?['"][^'"]*ui\//.test(candidate.engine)],
    ['headless friendly-target model remains DOM-free', !/\b(?:document|window|HTMLElement)\b|querySelector|cloneNode/.test(candidate.model)],
    ['target invalidation cancels and restores the origin after rebuild', /focusedFriendlyInvalid/.test(candidate.coop) && /restoreFriendlyCardFocus = armedFriendlyCard;/.test(candidate.coop) && /CSS\.escape\(restoreFriendlyCardFocus\)/.test(candidate.coop)],
    ['keyboard uses the same affordability predicate as pointer and pad', /if \(!cardAffordableFromSnapshot\(def, meP\)\) return;/.test(candidate.coop) && (candidate.coop.match(/cardAffordableFromSnapshot\(def, meP\)/g) || []).length >= 2],
    ['valid focused target survives an unrelated authoritative rebuild', /preservedTarget = focusedFriendlySeat/.test(candidate.coop) && /targetPlan\?\.legalIds\.includes\(focusedFriendlySeat\)/.test(candidate.coop) && /focusElement\(preservedTarget\)/.test(candidate.coop)],
    ['co-op flask shortcuts use configured action bindings', /matchAction/.test(candidate.coop) && /matchAction\(ev, `flask\$\{slot \+ 1\}`\)/.test(candidate.coop) && !/\{ f: 0, g: 1, h: 2 \}/.test(candidate.coop)],
    ['matched co-op flask shortcut is claimed before global hold input and consumed before gameplay handlers', /setScreenKeyClaim\(\(ev\) => matchedFlaskSlot\(ev\) >= 0\)/.test(candidate.coop) && /screenKeyClaim\?\.\(ev\)/.test(candidate.input) && /const slot = matchedFlaskSlot\(ev\);[\s\S]{0,100}ev\.preventDefault\(\);[\s\S]{0,100}ev\.stopImmediatePropagation\(\);/.test(candidate.coop)],
    ['client affordability applies authoritative power-cost reduction', /passiveSum\(registries, player\.relicIds, 'powerCostReduction'\)/.test(candidate.coop) && /energyCost = Math\.max\(0, energyCost - passiveSum/.test(candidate.coop)],
    ['client power reduction is Power-only and cannot fall below zero', /if \(def\.type === 'power'\)/.test(candidate.coop) && /Math\.max\(0, energyCost - passiveSum/.test(candidate.coop)],
    ['real-session down fixture seeds the ally through the validated tool-only seam', /state\.ally\.extraHand\.some/.test(candidate.session) && /allyPlayer\.piles\.hand\.push/.test(candidate.session) && /tool-ally-extra-/.test(candidate.session)],
    ['real-session rebind fixture seeds legacy flasks through the validated tool-only seam', /state\?\.flasks/.test(candidate.session) && /entity\.flasks = combatStartStateForTools\.flasks\.map/.test(candidate.session)],
    ['real-session discount fixture validates and seeds relic ids', /state\?\.relicIds/.test(candidate.session) && /entity\.relicIds = \[\.\.\.combatStartStateForTools\.relicIds\]/.test(candidate.session)],
    ['co-op snapshot transports authoritative relic ids for client pricing', /relicIds: \[\.\.\.P\.entity\.relicIds\]/.test(candidate.session)],
  ];
}
const checks = evaluateSource(source);

let pass = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (ok) pass += 1;
}
console.log(`friendly target source parity: ${pass}/${checks.length}`);

function evaluateArtifact(html, serverEngine, modelSource, sessionSource) {
  return [
    ['artifact carries blue self and green ally', /self: '#4d94e0'/.test(html) && /ally: '#49b675'/.test(html)],
    ['artifact carries shared semantic renderer', /function friendlyTargetPlan/.test(html) && /function renderTargetSilhouette/.test(html)],
    ['artifact excludes down and disconnected seats', /!player\.alive \|\| !player\.connected/.test(html)],
    ['artifact carries relationship target and AX focus state', /function decorateFriendlyTarget[\s\S]{0,500}dataset\.friendlyTarget[\s\S]{0,160}dataset\.focusable[\s\S]{0,240}Target \$\{label\} \(\$\{relationship\}\)/.test(html)],
    ['artifact carries Escape cancellation and focus restore', /ev\.key === 'Escape'/.test(html) && /function cancelFriendlyTargeting[\s\S]{0,500}if \(card\) focusElement\(card\);/.test(html)],
    ['artifact disarms before its one network intent', /armedFriendlyCard = null;\r?\n\s+hideTooltip\(\);\r?\n\s+render\(\);\r?\n\s+send\(\{ t: 'playCard'/.test(html)],
    ['selected-root server enforces friendly legality before spending', /targetId = assertFriendlyTarget\(friendlyPlan, targetId, C\.playerKey\);[\s\S]{0,1800}p\.energy -= cost;/.test(serverEngine)],
    ['artifact keeps hostile families out of friendly confirmation', /HOSTILE_TARGETS = new Set\(\['enemy', 'allEnemies', 'randomEnemy'\]\)/.test(html) && /HOSTILE_TARGETS\.has\(effect\.target\)/.test(html)],
    ['selected-root engine imports only the lower headless friendly-target model', /from ['"]\.\.\/model\/friendlyTargets\.js['"]/.test(serverEngine) && !/import\s+(?:[^;]*\s+from\s+)?['"][^'"]*ui\//.test(serverEngine)],
    ['selected-root friendly-target model remains DOM-free', !/\b(?:document|window|HTMLElement)\b|querySelector|cloneNode/.test(modelSource)],
    ['artifact restores origin focus when an armed target invalidates', /focusedFriendlyInvalid/.test(html) && /restoreFriendlyCardFocus = armedFriendlyCard;/.test(html) && /CSS\.escape\(restoreFriendlyCardFocus\)/.test(html)],
    ['artifact keyboard shares pointer and pad affordability', /if \(!cardAffordableFromSnapshot\(def, meP\)\) return;/.test(html) && (html.match(/cardAffordableFromSnapshot\(def, meP\)/g) || []).length >= 2],
    ['artifact preserves a still-legal focused target across snapshot rebuild', /preservedTarget = focusedFriendlySeat/.test(html) && /targetPlan\?\.legalIds\.includes\(focusedFriendlySeat\)/.test(html) && /focusElement\(preservedTarget\)/.test(html)],
    ['artifact co-op flask shortcuts use configured bindings', /matchAction\(ev, `flask\$\{slot \+ 1\}`\)/.test(html) && !/\{ f: 0, g: 1, h: 2 \}/.test(html)],
    ['artifact claims a matched co-op flask shortcut before global hold input and consumes it', /setScreenKeyClaim\(\(ev\) => matchedFlaskSlot\(ev\) >= 0\)/.test(html) && /screenKeyClaim\?\.\(ev\)/.test(html) && /const slot = matchedFlaskSlot\(ev\);[\s\S]{0,100}ev\.preventDefault\(\);[\s\S]{0,100}ev\.stopImmediatePropagation\(\);/.test(html)],
    ['artifact client applies authoritative power-cost reduction', /passiveSum\(registries, player\.relicIds, 'powerCostReduction'\)/.test(html) && /energyCost = Math\.max\(0, energyCost - passiveSum/.test(html)],
    ['artifact power reduction is Power-only and cannot fall below zero', /if \(def\.type === 'power'\)/.test(html) && /Math\.max\(0, energyCost - passiveSum/.test(html)],
    ['selected-root session carries validated ally fixture seeding', /state\.ally\.extraHand\.some/.test(sessionSource) && /allyPlayer\.piles\.hand\.push/.test(sessionSource) && /tool-ally-extra-/.test(sessionSource)],
    ['selected-root session carries validated legacy-flask fixture seeding', /state\?\.flasks/.test(sessionSource) && /entity\.flasks = combatStartStateForTools\.flasks\.map/.test(sessionSource)],
    ['selected-root session carries validated relic fixture seeding', /state\?\.relicIds/.test(sessionSource) && /entity\.relicIds = \[\.\.\.combatStartStateForTools\.relicIds\]/.test(sessionSource)],
    ['selected-root session transports authoritative relic ids', /relicIds: \[\.\.\.P\.entity\.relicIds\]/.test(sessionSource)],
  ];
}

if (process.argv.includes('--artifact-check')) {
  const artifact = read('AshenSpire.html');
  const artifactChecks = evaluateArtifact(artifact, read('src/engine/coopCombat.js'), read('src/model/friendlyTargets.js'), read('tools/session.mjs'));
  for (const [label, ok] of artifactChecks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const artifactGreen = artifactChecks.every(([, ok]) => ok);
  console.log(`friendly target artifact parity: ${artifactGreen ? 'OK' : 'RED'} (${artifactChecks.filter(([, ok]) => ok).length}/${artifactChecks.length})`);
  process.exit(artifactGreen ? 0 : 1);
}

let dynamicPass = 0;
let dynamicTotal = 0;
const check = (label, fn) => {
  dynamicTotal += 1;
  try { fn(); dynamicPass += 1; console.log(`PASS ${label}`); }
  catch (error) { console.log(`FAIL ${label} — ${error.message}`); }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const seats = [
  { id: 'caster', alive: true, connected: true, ended: false },
  { id: 'ally', alive: true, connected: true, ended: true },
  { id: 'down', alive: false, connected: true, ended: false },
  { id: 'away', alive: true, connected: false, ended: false },
];
const selfDef = { effects: [{ op: 'block', target: 'self', amount: 5 }] };
const allyDef = { effects: [{ op: 'block', target: 'ally', amount: 5 }] };
const mixedDef = { effects: [{ op: 'block', target: 'ally', amount: 5 }, { op: 'block', target: 'self', amount: 2 }] };
check('self-only plan exposes exactly the blue caster', () => {
  const plan = friendlyTargetPlan(selfDef, 'caster', seats);
  assert(JSON.stringify(plan.targets) === JSON.stringify([{ id: 'caster', relationship: 'self' }]), JSON.stringify(plan.targets));
});
check('ally-only plan exposes the living connected ended ally, never self/down/away', () => {
  const plan = friendlyTargetPlan(allyDef, 'caster', seats);
  assert(JSON.stringify(plan.targets) === JSON.stringify([{ id: 'ally', relationship: 'ally' }]), JSON.stringify(plan.targets));
});
check('mixed plan exposes blue self and green living ally', () => {
  const plan = friendlyTargetPlan(mixedDef, 'caster', seats);
  assert(plan.targets.length === 2 && plan.targets[0].relationship === 'self' && plan.targets[1].relationship === 'ally', JSON.stringify(plan.targets));
});

const REG = createRegistries(contentBundle);
const hostileSelfCards = [
  'meteorSwarm', 'gravityWell', 'radiantSpray', 'supernova', 'starfallBeam',
  'graveOffering', 'butterflyPlague', 'bloodHarvest',
];
check('all hostile target shapes and the eight hostile+self cards bypass friendly confirmation', () => {
  for (const target of ['enemy', 'allEnemies', 'randomEnemy']) {
    assert(friendlyTargetMode({ effects: [{ op: 'damage', target }, { op: 'block', target: 'self' }] }) === 'none', `${target} became friendly`);
  }
  const wrong = hostileSelfCards.filter((id) => friendlyTargetMode(REG.cards.get(id)) !== 'none');
  assert(wrong.length === 0, `hostile cards became friendly: ${wrong.join(', ')}`);
});
const player = (id, cardId) => ({
  id, name: id, classId: 'starseer', maxHp: 72, hp: 60,
  energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
  deck: Array.from({ length: 5 }, (_, index) => ({ instanceId: `${id}-${cardId}-${index}`, cardId, upgraded: false })),
});
const fight = (cardId = 'rallyingBanner') => createCoopCombat({
  registries: REG, rng: createRng(209), players: [player('caster', cardId), player('ally', cardId)], enemyIds: ['blightHound'],
});
const firstCard = (C, id = 'caster') => C.players.get(id).piles.hand[0];
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

check('authoritative ally play lands on chosen teammate once', () => {
  const C = fight();
  const before = C.players.get('caster').piles.hand.length;
  playCard(C, 'caster', firstCard(C).instanceId, 'ally');
  assert(C.players.get('ally').entity.block === 10, 'ally block missing');
  assert(C.players.get('caster').entity.block === 0, 'caster incorrectly targeted');
  assert(C.players.get('caster').piles.hand.length === before - 1, 'card not spent exactly once');
});
check('authoritative ally-only self target is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'caster')), 'self target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative disconnected ally is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  leaveCombat(C, 'ally');
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'away target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative down ally is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  const ally = C.players.get('ally'); ally.entity.hp = 0; ally.entity.alive = false;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'down target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative mixed Oath accepts self and ally choices', () => {
  for (const targetId of ['caster', 'ally']) {
    const C = fight('ashOath');
    playCard(C, 'caster', firstCard(C).instanceId, targetId);
    assert(Object.keys(C.players.get('caster').entity.statuses).length > 0, `caster status missing for ${targetId}`);
  }
});
check('authoritative unaffordable friendly play is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.energy = 0;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'unaffordable play accepted');
  assert(P.entity.energy === 0 && P.piles.hand.includes(card), 'unaffordable play spent resources');
});
check('authoritative Ancestral Horn plays a one-cost Power at zero energy', () => {
  const C = fight('thornHaloCard'); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.relicIds = ['ancestralHorn'];
  P.entity.energy = 0;
  playCard(C, 'caster', card.instanceId, 'caster');
  assert(P.entity.energy === 0 && !P.piles.hand.includes(card) && P.entity.statuses.thornHalo, 'discounted Power did not resolve at zero energy');
});
check('authoritative one-cost Power without Ancestral Horn is refused at zero energy', () => {
  const C = fight('thornHaloCard'); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.energy = 0;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'caster')), 'undiscounted Power played at zero energy');
  assert(P.entity.energy === 0 && P.piles.hand.includes(card), 'refused Power spent resources');
});
check('Ancestral Horn does not discount a non-Power', () => {
  const C = fight('rallyingBanner'); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.relicIds = ['ancestralHorn'];
  P.entity.energy = 0;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'Horn discounted a non-Power');
  assert(P.entity.energy === 0 && P.piles.hand.includes(card), 'refused non-Power spent resources');
});
check('Ancestral Horn never bypasses an insufficient-mana refusal', () => {
  const C = fight('urgentHeal'); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.relicIds = ['ancestralHorn'];
  P.entity.energy = 3;
  P.entity.mana = 0;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'caster')), 'Horn bypassed the mana requirement');
  assert(P.entity.energy === 3 && P.entity.mana === 0 && P.piles.hand.includes(card), 'mana refusal spent resources');
});
check('ordinary paid friendly card still spends its exact cost', () => {
  const C = fight('rallyingBanner'); const P = C.players.get('caster'); const card = firstCard(C);
  P.entity.energy = 1;
  playCard(C, 'caster', card.instanceId, 'ally');
  assert(P.entity.energy === 0 && !P.piles.hand.includes(card), 'paid card did not spend exactly one energy');
});

if (process.argv.includes('--selftest-source')) {
  const plants = [
    ['generic gold ally', 'shared', (text) => text.replace("ally: '#49b675'", "ally: '#d5ad57'")],
    ['swapped relationship colors', 'shared', (text) => text.replace("self: '#4d94e0'", "self: '#49b675'")],
    ['down or away becomes legal', 'model', (text) => text.replace('!player.alive || !player.connected', '!player.alive && !player.connected')],
    ['controller focus removed', 'shared', (text) => text.replace("combatantEl.dataset.focusable = '';", '')],
    ['cancel focus restoration removed', 'coop', (text) => text.replace('if (card) focusElement(card);', '')],
    ['confirm can replay before disarm', 'coop', (text) => text.replace('armedFriendlyCard = null;\n          hideTooltip();\n          render();\n          send(', 'send(')],
    ['server legality bypassed', 'engine', (text) => text.replace('targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);', 'targetId = targetId;')],
    ['hostile AoE+self arms a false friendly prompt', 'model', (text) => text.replace("['enemy', 'allEnemies', 'randomEnemy']", "['enemy']")],
    ['engine reaches upward into UI friendly-target code', 'engine', (text) => text.replace("../model/friendlyTargets.js", "../ui/components/friendlyTargets.js")],
    ['headless friendly-target model gains a DOM dependency', 'model', (text) => `${text}\nconst architecturePlant = document.body;\n`],
    ['target invalidation loses origin focus', 'coop', (text) => text.replace('restoreFriendlyCardFocus = armedFriendlyCard;', 'restoreFriendlyCardFocus = null;')],
    ['number key bypasses affordability', 'coop', (text) => text.replace('if (!cardAffordableFromSnapshot(def, meP)) return;', 'if (false) return;')],
    ['snapshot rebuild resets a valid chosen target', 'coop', (text) => text.replace('if (!preservedTarget || !focusElement(preservedTarget)) focusFirst', 'if (true) focusFirst')],
    ['rebound flask shortcuts return to literals', 'coop', (text) => text.replace('matchAction(ev, `flask${slot + 1}`)', "({ 0: 'f', 1: 'g', 2: 'h' }[slot] === ev.key.toLowerCase())")],
    ['rebound-flask-prearm: matched shortcut arms the earlier global hold', 'input', (text) => text.replace('if (!typing && screenKeyClaim?.(ev)) {', 'if (false) {')],
    ['rebound-flask-fallthrough: matched shortcut reaches card/end-turn handler', 'coop', (text) => text.replace('ev.stopImmediatePropagation();', '/* planted: matched Flask event bubbles into gameplay */')],
    ['effective-cost-base-def: client ignores Ancestral Horn power reduction', 'coop', (text) => text.replace("energyCost = Math.max(0, energyCost - passiveSum(registries, player.relicIds, 'powerCostReduction'));", 'energyCost = energyCost;')],
    ['effective-cost-nonpower-leak: Horn discount escapes the Power branch', 'coop', (text) => text.replace("if (def.type === 'power') {", 'if (true) {')],
    ['ally fixture bypasses validated test-only hand seam', 'session', (text) => text.replace('allyPlayer.piles.hand.push', 'player.piles.hand.push')],
    ['flask rebind fixture bypasses the validated test-only seam', 'session', (text) => text.replace('entity.flasks = combatStartStateForTools.flasks.map', 'entity.flasks = [].map')],
    ['discount fixture bypasses validated relic seam', 'session', (text) => text.replace('entity.relicIds = [...combatStartStateForTools.relicIds]', 'entity.relicIds = []')],
    ['snapshot drops authoritative relic ids', 'session', (text) => text.replace('relicIds: [...P.entity.relicIds]', 'relicIds: []')],
  ];
  let caught = 0;
  for (const [label, key, mutate] of plants) {
    const candidate = { ...source, [key]: mutate(source[key]) };
    const red = evaluateSource(candidate).some(([, ok]) => !ok);
    console.log(`${red ? 'CAUGHT' : 'MISSED'} plant: ${label}`);
    if (red) caught += 1;
  }
  console.log(`source plants: ${caught}/${plants.length}`);
  if (caught !== plants.length) process.exitCode = 1;
  const crlfSource = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\n/g, '\r\n')]));
  const crlfChecks = evaluateSource(crlfSource);
  const crlfGreen = crlfChecks.every(([, ok]) => ok);
  console.log(`${crlfGreen ? 'PASS' : 'FAIL'} forced-CRLF source contract${crlfGreen ? '' : ` — ${crlfChecks.filter(([, ok]) => !ok).map(([label]) => label).join('; ')}`}`);
  if (!crlfGreen) process.exitCode = 1;
}

if (process.argv.includes('--selftest-artifact')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const artifactPlants = [
    ['selected artifact generic gold ally', 'AshenSpire.html', "ally: '#49b675'", "ally: '#d5ad57'"],
    ['selected artifact swapped self color', 'AshenSpire.html', "self: '#4d94e0'", "self: '#49b675'"],
    ['selected artifact allows down or away', 'AshenSpire.html', '!player.alive || !player.connected', '!player.alive && !player.connected', true],
    ['selected artifact drops controller focus', 'AshenSpire.html', "combatantEl.dataset.focusable = '';", ''],
    ['selected artifact drops cancel focus restore', 'AshenSpire.html', 'if (card) focusElement(card);', ''],
    ['selected artifact can replay before disarm', 'AshenSpire.html', 'armedFriendlyCard = null;\n          hideTooltip();\n          render();\n          send(', 'send('],
    ['selected-root server bypasses legality', 'src/engine/coopCombat.js', 'targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);', 'targetId = targetId;'],
    ['selected artifact arms hostile AoE+self', 'AshenSpire.html', "['enemy', 'allEnemies', 'randomEnemy']", "['enemy']"],
    ['selected-root engine reaches upward into UI friendly-target code', 'src/engine/coopCombat.js', "import { assertFriendlyTarget, friendlyTargetPlan } from '../model/friendlyTargets.js';", "import { assertFriendlyTarget, friendlyTargetPlan } from '../model/friendlyTargets.js';\nimport '../ui/components/friendlyTargets.js';"],
    ['selected-root model gains a DOM dependency', 'src/model/friendlyTargets.js', "// Headless friendly-target semantics", "function architecturePlant() { return document.body; }\n// Headless friendly-target semantics"],
    ['selected artifact loses invalidated origin focus', 'AshenSpire.html', 'restoreFriendlyCardFocus = armedFriendlyCard;', 'restoreFriendlyCardFocus = null;'],
    ['selected artifact number key bypasses affordability', 'AshenSpire.html', 'if (!cardAffordableFromSnapshot(def, meP)) return;', 'if (false) return;'],
    ['selected artifact resets a valid chosen target', 'AshenSpire.html', 'if (!preservedTarget || !focusElement(preservedTarget)) focusFirst', 'if (true) focusFirst'],
    ['selected artifact returns flask shortcuts to literals', 'AshenSpire.html', 'matchAction(ev, `flask${slot + 1}`)', "({ 0: 'f', 1: 'g', 2: 'h' }[slot] === ev.key.toLowerCase())", true],
    ['selected artifact rebound-flask-prearm arms the earlier global hold', 'AshenSpire.html', 'if (!typing && screenKeyClaim?.(ev)) {', 'if (false) {'],
    ['selected artifact rebound-flask-fallthrough reaches gameplay', 'AshenSpire.html', "const slot = matchedFlaskSlot(ev);\n    if (slot >= 0) {\n      ev.preventDefault();\n      ev.stopImmediatePropagation();", "const slot = matchedFlaskSlot(ev);\n    if (slot >= 0) {\n      ev.preventDefault();\n      /* planted: matched Flask event bubbles into gameplay */"],
    ['selected artifact effective-cost-base-def ignores Ancestral Horn power reduction', 'AshenSpire.html', "energyCost = Math.max(0, energyCost - passiveSum(registries, player.relicIds, 'powerCostReduction'));", 'energyCost = energyCost;'],
    ['selected artifact effective-cost-nonpower-leak escapes the Power branch', 'AshenSpire.html', "if (def.type === 'power') {", 'if (true) {', true],
    ['selected-root ally fixture seeds the wrong hand', 'tools/session.mjs', 'allyPlayer.piles.hand.push', 'player.piles.hand.push'],
    ['selected-root flask fixture bypasses validation', 'tools/session.mjs', 'entity.flasks = combatStartStateForTools.flasks.map', 'entity.flasks = [].map'],
    ['selected-root discount fixture bypasses relic validation', 'tools/session.mjs', 'entity.relicIds = [...combatStartStateForTools.relicIds]', 'entity.relicIds = []'],
    ['selected-root snapshot drops relic ids', 'tools/session.mjs', 'relicIds: [...P.entity.relicIds]', 'relicIds: []'],
  ];
  const status = await doorSelftest({
    tool: 'friendly-target-parity.mjs', args: ['--artifact-check'], timeoutMs: 300000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants.map(([name, file, find, replace, all = false]) => ({
      name, file, find, replace, all, expectRed: /friendly target artifact parity: RED/,
    })),
  });
  process.exit(status);
}

console.log(`friendly target dynamic parity: ${dynamicPass}/${dynamicTotal}`);
if (pass !== checks.length || dynamicPass !== dynamicTotal) process.exitCode = 1;

const argOf = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  return {
    ready: new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function browserDoor() {
  const captureBefore = process.argv.includes('--capture-before');
  const standalone = process.argv.includes('--standalone');
  const browserFlag = argOf('--browser');
  const candidates = [
    browserFlag && !browserFlag.startsWith('--') ? browserFlag : null,
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const browserPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!browserPath) throw new Error('Chrome or Edge is required for --browser');
  const only = argOf('--shape');
  const textSize = argOf('--text') || 'M';
  if (!['M', 'XL'].includes(textSize)) throw new Error(`--text must be M or XL (got ${textSize})`);
  const shapes = [
    { tag: '320x640', width: 320, height: 640, dpr: 3 },
    { tag: '390x844', width: 390, height: 844, dpr: 3 },
    { tag: '1200x730', width: 1200, height: 730, dpr: 1 },
  ].filter((shape) => !only || shape.tag === only);
  if (!shapes.length) throw new Error(`unknown --shape ${only}`);
  const shotsDir = argOf('--shots');
  if (shotsDir) fs.mkdirSync(path.resolve(ROOT, shotsDir), { recursive: true });
  const findings = [];
  const observed = (condition, label, detail = '') => {
    console.log(`${condition ? 'PASS' : 'FAIL'} browser ${label}${detail ? ` — ${detail}` : ''}`);
    if (!condition) findings.push(`${label}${detail ? `: ${detail}` : ''}`);
  };
  const { wsUrl, close: closeBrowser } = await launchBrowser({
    prefix: 'friendly-target-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  let port = 43920;
  const makeTab = async (shape) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.dpr, mobile: shape.dpr > 1,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.dpr > 1, maxTouchPoints: 5 }, sessionId);
    return { targetId, sessionId };
  };
  const evaluate = async (tab, expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser expression threw');
    return result.result.value;
  };
  const until = async (tab, expression, label, timeout = 25000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(tab, expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  const click = (selector) => `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true})()`;
  const activate = async (tab, selector, touch = false) => {
    const point = await evaluate(tab, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const b=e.getBoundingClientRect(),x=Math.max(1,Math.min(innerWidth-1,(b.left+b.right)/2)),y=Math.max(1,Math.min(innerHeight-1,(b.top+b.bottom)/2)),h=document.elementFromPoint(x,y);return{x,y,hit:h?.className||h?.tagName,text:h?.textContent?.trim().slice(0,40)}})()`);
    if (!point) return false;
    if (touch) {
      const touchPoint = [{ x: point.x, y: point.y, radiusX: 12, radiusY: 12, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint }, tab.sessionId);
      await wait(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, tab.sessionId);
      await wait(300);
    } else {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, tab.sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, tab.sessionId);
    }
    return true;
  };
  const key = async (tab, value) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value === 'Escape' ? 'Escape' : value }, tab.sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value === 'Escape' ? 'Escape' : value }, tab.sessionId);
  };
  const capture = async (tab, name) => {
    if (!shotsDir) return;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, tab.sessionId);
    fs.writeFileSync(path.resolve(ROOT, shotsDir, name), Buffer.from(shot.data, 'base64'));
  };

  try {
    for (const shape of shapes) {
      setCombatStartStateForTools({
        name: 'Fenn', hp: 60, block: 0,
        relicIds: ['ancestralHorn'],
        extraHand: [
          'ironSkin', 'rallyingBanner', 'rallyingBanner', 'ashOath',
          'thornHaloCard', 'thornHaloCard', 'thornHaloCard',
          'thornHaloCard', 'thornHaloCard', 'thornHaloCard',
        ],
        flasks: ['flaskOfFerocity', 'flaskOfStone', 'blightCoating'],
        ally: { name: 'Wren', hp: 1, block: 0, extraHand: ['bloodPact'] },
      });
      const server = await serve({ root: ROOT, port: port++, open: false, lan: true });
      const browserSettings = {
        textSize,
        keyBindings: { flask1: '1', flask2: 'q', flask3: 'e' },
        bindings: { flask1: 8 },
      };
      const settingsStore = createMemoryStorage();
      const settingsSaves = createSaveManager(settingsStore);
      settingsSaves.ensureProfile();
      settingsSaves.saveMeta({ ...settingsSaves.loadMeta(), settings: browserSettings });
      const browserMeta = settingsStore.getItem(META_KEY);
      const base = `http://localhost:${server.port}/${captureBefore || standalone ? 'AshenSpire.html' : 'index.html'}`;
      const host = await makeTab(shape);
      const guest = await makeTab(shape);
      const support = await makeTab(shape);
      console.log(`\n${shape.tag} Text ${textSize} real two-client friendly targeting`);
      const evidenceCell = shotsDir && ((shape.tag === '390x844' && textSize === 'XL') || (shape.tag === '1200x730' && textSize === 'M'));
      const evidenceCapture = async (state, label) => {
        if (!evidenceCell) return;
        await evaluate(guest, `(()=>{document.querySelector('.evidence-caption')?.remove();const n=document.createElement('div');n.className='evidence-caption';n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';n.textContent=${JSON.stringify(`${standalone ? 'SELECTED ROOT' : 'SOURCE'} · #209 · ${label} · ${shape.tag} · Text ${textSize}`)};document.body.appendChild(n);return true})()`);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        await capture(guest, `friendly-target-after-${standalone ? 'root' : 'source'}-${state}-${shape.tag}${textSuffix}.png`);
      };
      try {
        console.log('  SETUP host navigate');
        await cdp.send('Page.navigate', { url: base }, host.sessionId);
        await until(host, `location.origin===${JSON.stringify(`http://localhost:${server.port}`)}`, 'host origin');
        await evaluate(host, `localStorage.setItem(${JSON.stringify(META_KEY)},${JSON.stringify(browserMeta)})`);
        await cdp.send('Page.navigate', { url: `${base}?friendlySettings=1` }, host.sessionId);
        await until(host, `location.search==='?friendlySettings=1'`, 'host configured reload');
        console.log('  SETUP host LAN');
        await until(host, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host LAN door');
        await evaluate(host, click('#lan-play'));
        console.log('  SETUP host room');
        await until(host, `!!document.querySelector('#lb-name')`, 'host lobby');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-name');n.value='Wren';n.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#lb-host').click();return true})()`);
        await until(host, `/at the fire/i.test(document.querySelector('.lobby-room .as-title-m')?.textContent || '')`, 'host fire');

        console.log('  SETUP guest join');
        await cdp.send('Page.navigate', { url: base }, guest.sessionId);
        await until(guest, `location.origin===${JSON.stringify(`http://localhost:${server.port}`)}`, 'guest origin');
        await evaluate(guest, `localStorage.setItem(${JSON.stringify(META_KEY)},${JSON.stringify(browserMeta)})`);
        await cdp.send('Page.navigate', { url: `${base}?friendlySettings=1` }, guest.sessionId);
        await until(guest, `location.search==='?friendlySettings=1'`, 'guest configured reload');
        await until(guest, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest LAN door');
        await evaluate(guest, click('#lan-play'));
        await until(guest, `!!document.querySelector('#lb-name')`, 'guest lobby');
        await evaluate(guest, `(()=>{const n=document.querySelector('#lb-name');n.value='Fenn';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await until(guest, `!!document.querySelector('.lb-join')`, 'guest sees host');
        await evaluate(guest, click('.lb-join'));
        await until(guest, `!!document.querySelector('#lb-ready')`, 'guest room');
        await evaluate(guest, `(()=>{const p=[...document.querySelectorAll('#lb-classes .class-pick')].find(x=>x.querySelector('h3')?.textContent==='Reaver');p?.click();return !!p})()`);
        await until(host, `document.querySelector('#lb-roster')?.textContent.includes('Reaver')`, 'host sees guest class');

        console.log('  SETUP support join');
        await cdp.send('Page.navigate', { url: base }, support.sessionId);
        await until(support, `location.origin===${JSON.stringify(`http://localhost:${server.port}`)}`, 'support origin');
        await evaluate(support, `localStorage.setItem(${JSON.stringify(META_KEY)},${JSON.stringify(browserMeta)})`);
        await cdp.send('Page.navigate', { url: `${base}?friendlySettings=1` }, support.sessionId);
        await until(support, `location.search==='?friendlySettings=1'`, 'support configured reload');
        await until(support, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'support LAN door');
        await evaluate(support, click('#lan-play'));
        await until(support, `!!document.querySelector('#lb-name')`, 'support lobby');
        await evaluate(support, `(()=>{const n=document.querySelector('#lb-name');n.value='Vale';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await until(support, `!!document.querySelector('.lb-join')`, 'support sees host');
        await evaluate(support, click('.lb-join'));
        await until(support, `!!document.querySelector('#lb-ready')`, 'support room');
        await evaluate(support, `(()=>{const p=[...document.querySelectorAll('#lb-classes .class-pick')].find(x=>x.querySelector('h3')?.textContent==='Starseer');p?.click();return !!p})()`);
        await until(host, `document.querySelector('#lb-roster')?.textContent.includes('Starseer')`, 'host sees support class');
        await evaluate(support, click('#lb-ready'));
        await evaluate(guest, click('#lb-ready'));
        console.log('  SETUP start');
        await until(host, `!document.querySelector('#lb-start')?.disabled`, 'host sees ready');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-seed');n.value='FRIEND209';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#lb-start').click();return true})()`);
        await until(host, `!!document.querySelector('.mapscreen')`, 'host map');
        await until(guest, `!!document.querySelector('.mapscreen')`, 'guest map');
        await until(support, `!!document.querySelector('.mapscreen')`, 'support map');
        console.log('  SETUP map votes');
        await evaluate(host, click('.map-node.reachable'));
        await evaluate(guest, click('.map-node.reachable'));
        await evaluate(support, click('.map-node.reachable'));
        await until(guest, `!!document.querySelector('.combat.coop')`, 'guest combat');
        await until(support, `!!document.querySelector('.combat.coop')`, 'support combat');
        await until(guest, `[...document.querySelectorAll('.hand .card')].some(c=>c.textContent.includes('Oath of Ash'))`, 'friendly fixture cards');
        if (shape.dpr > 1) await cdp.send('Target.activateTarget', { targetId: guest.targetId });
        console.log('  SETUP combat ready');

        const storedBindings = await evaluate(guest, `JSON.parse(localStorage.getItem(${JSON.stringify(META_KEY)}))?.settings`);
        observed(storedBindings?.keyBindings?.flask1 === '1' && storedBindings?.keyBindings?.flask2 === 'q' && storedBindings?.keyBindings?.flask3 === 'e' && storedBindings?.bindings?.flask1 === 8, 'real profile stores collision-prone keyboard and standard-pad flask bindings', JSON.stringify(storedBindings));
        if (!standalone) {
          const liveBindings = await evaluate(guest, `import('/src/ui/input.js').then(m=>({keys:m.getKeyBindings(),pad:m.getBindings()}))`);
          observed(liveBindings?.keys?.flask1 === '1' && liveBindings?.keys?.flask2 === 'q' && liveBindings?.keys?.flask3 === 'e' && liveBindings?.pad?.flask1 === 8, 'running input module applied the collision-prone flask bindings', JSON.stringify(liveBindings));
        }

        // Standard pad button 8 synthesizes the configured Flask 1 key. Set
        // the public gamepad door up before the collision checks so both the
        // literal and pad-synthesized `1` must be consumed by flaskKeyHandler.
        await evaluate(guest, `(()=>{const pad={index:0,connected:true,mapping:'standard',id:'friendly-target parity pad',buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad,null,null,null]});window.__friendlyPad={lastKey:null,press(i){pad.buttons[i]={pressed:true,value:1}},release(i){pad.buttons[i]={pressed:false,value:0}}};addEventListener('keydown',e=>window.__friendlyPad.lastKey=e.key);dispatchEvent(new Event('gamepadconnected'));return true})()`);
        const padTap = async (button) => {
          await evaluate(guest, `window.__friendlyPad.press(${button})`); await wait(180);
          await evaluate(guest, `window.__friendlyPad.release(${button})`); await wait(180);
        };

        for (const [slot, reboundKey] of [['1', '1'], ['2', 'q'], ['3', 'e']]) {
          const beforeShortcut = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
          if (reboundKey === 'e') {
            // A real hold with OS-style repeats crosses the 600 ms End Turn
            // threshold. The configured Flask claim must prevent input.js from
            // arming that earlier live beat before coop's capture handler runs.
            await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: reboundKey, code: 'KeyE' }, guest.sessionId);
            for (let repeat = 0; repeat < 4; repeat++) {
              await wait(180);
              await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: reboundKey, code: 'KeyE', autoRepeat: true }, guest.sessionId);
            }
            await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: reboundKey, code: 'KeyE' }, guest.sessionId);
            await wait(180);
          } else {
            await key(guest, reboundKey);
          }
          await until(guest, `!!document.querySelector('.flask-action-menu')`, `rebound keyboard Flask ${slot} menu`);
          const afterShortcut = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
          observed(JSON.stringify(afterShortcut) === JSON.stringify(beforeShortcut), `configured collision binding opens Flask ${slot} only, without card play, targeting, spend, or end turn`, `${JSON.stringify(beforeShortcut)}→${JSON.stringify(afterShortcut)}`);
          if (reboundKey === 'e') {
            const latentEnd = await evaluate(guest, `({holding:document.querySelector('#coop-endturn')?.dataset.hold==='holding',armed:document.querySelector('#coop-endturn')?.hasAttribute('data-beat-armed'),ended:window.__coopSnapshot.scene.players.find(p=>p.id===window.__coopSnapshot.party.find(x=>x.name==='Fenn')?.id)?.ended})`);
            observed(latentEnd.holding === false && latentEnd.armed === false && latentEnd.ended === false, 'held/repeated rebound e never arms or confirms latent End Turn behind the Flask menu', JSON.stringify(latentEnd));
          }
          if (slot === '1') await evidenceCapture('rebound-flask', 'Rebound Flask 1 on key 1 · menu only · no card play');
          await key(guest, 'Escape');
          await until(guest, `!document.querySelector('.flask-action-menu')`, `rebound keyboard Flask ${slot} menu closes`);
        }

        const beforePadShortcut = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
        await padTap(8);
        await until(guest, `!!document.querySelector('.flask-action-menu')`, 'collision-bound standard-pad Flask 1 menu');
        const afterPadShortcut = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length,key:window.__friendlyPad.lastKey}})()`);
        observed(afterPadShortcut.key === 'Escape' && JSON.stringify({ ...afterPadShortcut, key: undefined }) === JSON.stringify({ ...beforePadShortcut, key: undefined }), 'standard-pad synthesized collision key opens Flask 1 only and is consumed before downstream input observers/gameplay', `${JSON.stringify(beforePadShortcut)}→${JSON.stringify(afterPadShortcut)}`);
        await padTap(1);
        await until(guest, `!document.querySelector('.flask-action-menu')`, 'collision-bound standard-pad Flask 1 menu closes');

        // The rest of the matrix exercises product number/q card input. Restore
        // non-colliding flask keys in the running input module after the exact
        // collision controls above; the persisted collision settings remain
        // proven by the profile/live-module assertions.
        await evaluate(guest, `import('/src/ui/input.js').then(m=>m.setKeyBindings({flask1:'z',flask2:'x',flask3:'c'}))`);

        if (captureBefore) {
          await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));c?.click();return !!c})()`);
          await until(guest, `document.querySelectorAll('.coop-seat.throw-target').length===3`, 'pre-change generic target seats');
          const before = await evaluate(guest, `(()=>[...document.querySelectorAll('.coop-seat')].map(e=>({seat:e.dataset.seat,generic:e.classList.contains('throw-target'),friendly:e.dataset.friendlyTarget||null,focus:e.hasAttribute('data-focusable')})))()`);
          observed(before.length === 3 && before.every((entry) => entry.generic && !entry.friendly && !entry.focus), 'pre-change selected standalone reproduces generic all-seat targeting RED', JSON.stringify(before));
          if (shotsDir) {
            await evaluate(guest, `(()=>{const n=document.createElement('div');n.className='evidence-caption';n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';n.textContent='SELECTED ROOT BEFORE · #209 RED · Rallying Banner · generic gold on self + ally · no AX target state · ${shape.tag} · Text ${textSize}';document.body.appendChild(n);return true})()`);
            await capture(guest, `friendly-target-before-root-${shape.tag}${textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`}.png`);
          }
          continue;
        }

        // Mouse/touch door: self-only owns exactly one blue caster.
        const ironSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Iron Skin'));if(!c)return null;c.dataset.friendlyProbe='iron';return '[data-friendly-probe="iron"]'})()`);
        observed(await activate(guest, ironSelector, shape.dpr > 1), shape.dpr > 1 ? 'touch arms a real self-only card' : 'mouse arms a real self-only card');
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'self-only targeting appears');
        const selfOnly = await evaluate(guest, `(()=>[...document.querySelectorAll('[data-friendly-target]')].map(e=>({seat:e.dataset.seat,rel:e.dataset.friendlyTarget,aria:e.getAttribute('aria-label'),focus:e.hasAttribute('data-focusable'),color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color')})))()`);
        observed(selfOnly.length === 1 && selfOnly[0].rel === 'self' && selfOnly[0].focus && selfOnly[0].color === '#4d94e0', 'self-only blue caster and AX focus', JSON.stringify(selfOnly));
        await evidenceCapture('self', 'Iron Skin self-only · blue caster · AX target');
        await key(guest, 'Escape');
        const selfCancel = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,card:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Iron Skin'))?.classList.contains('gp-focus')})`);
        observed(selfCancel.targets === 0 && selfCancel.card === true, 'Escape cancels without spend and restores exact card focus', JSON.stringify(selfCancel));
        await evidenceCapture('cancel', 'Cancel · no target markers · exact card focus restored');

        // A living, connected teammate who already ended remains a legal ally.
        // Vale ends here so Wren remains able to drive the later real-engine
        // self-down snapshot while Fenn's targeting transaction stays armed.
        await evaluate(support, click('#coop-endturn'));
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===s.party.find(m=>m.name==='Vale')?.id);return p?.ended===true})()`, 'ended teammate snapshot');

        // Mouse/touch ally arm/confirm: no self highlight.
        const bannerSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));if(!c)return null;c.dataset.friendlyProbe='banner';return '[data-friendly-probe="banner"]'})()`);
        await activate(guest, bannerSelector, shape.dpr > 1);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===2`, 'ally-only targeting appears');
        const ids = await evaluate(guest, `(()=>{const s=window.__coopSnapshot;return{actor:s.party.find(p=>p.name==='Fenn')?.id,ally:s.party.find(p=>p.name==='Wren')?.id,support:s.party.find(p=>p.name==='Vale')?.id}})()`);
        const allyOnly = await evaluate(guest, `(()=>[...document.querySelectorAll('[data-friendly-target]')].map(e=>({seat:e.dataset.seat,rel:e.dataset.friendlyTarget,color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color')})))()`);
        observed(allyOnly.length === 2 && allyOnly.every((entry) => entry.seat !== ids.actor && entry.rel === 'ally' && entry.color === '#49b675') && allyOnly.some((entry) => entry.seat === ids.ally) && allyOnly.some((entry) => entry.seat === ids.support), 'ally-only green legal allies exclude self', JSON.stringify(allyOnly));
        await evidenceCapture('ally', 'Rallying Banner ally-only · green ally · self excluded');
        await activate(guest, `[data-seat="${ids.ally}"]`, shape.dpr > 1);
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.ally)});return p?.block===10})()`, 'Rallying Banner server result');
        const banner = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,cards:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Rallying Banner')).length})`);
        observed(banner.targets === 0 && banner.cards === 1, `${shape.dpr > 1 ? 'touch' : 'mouse'} confirm commits and spends exactly once`, JSON.stringify(banner));

        // Keyboard number arm reaches mixed blue/green, then Escape restores.
        const oathIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Oath of Ash'))`);
        const oathKey = oathIndex === 9 ? 'q' : String(oathIndex + 1);
        await key(guest, oathKey);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===3`, 'keyboard mixed targeting');
        const mixed = await evaluate(guest, `(()=>{const layer=document.querySelector('.fx-layer')?.getBoundingClientRect(),targets=[...document.querySelectorAll('[data-friendly-target]')].map(e=>{const r=e.getBoundingClientRect();return{seat:e.dataset.seat,rel:e.dataset.friendlyTarget,color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color'),aria:e.getAttribute('aria-label'),onGlass:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}});return{targets,layer:!!layer}})()`);
        observed(mixed.targets.length === 3 && mixed.targets.filter((t) => t.rel === 'self' && t.color === '#4d94e0').length === 1 && mixed.targets.filter((t) => t.rel === 'ally' && t.color === '#49b675').length === 2 && mixed.targets.every((t) => t.aria), 'keyboard mixed target relationship/AX parity', JSON.stringify(mixed));
        await evidenceCapture('mixed', 'Oath of Ash mixed · self blue · ally green');
        // Standard-mapping gamepad shim above continues through its public
        // navigator.getGamepads door for B Cancel and A Confirm.
        const focusBeforeMove = await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`);
        let focusAfterMove = focusBeforeMove;
        const targetDirections = [15, 13, 14, 12];
        for (let move = 0; move < 12 && focusAfterMove === focusBeforeMove; move++) {
          await padTap(targetDirections[move % targetDirections.length]);
          const candidate = await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`);
          if (candidate && candidate !== focusBeforeMove) focusAfterMove = candidate;
        }
        observed(!!focusBeforeMove && !!focusAfterMove && focusBeforeMove !== focusAfterMove, 'controller traverses within the mixed legal target set', `${focusBeforeMove}→${focusAfterMove}`);
        const enemyHpBeforeSnapshot = await evaluate(guest, `window.__coopSnapshot.scene.enemies.find(e=>e.hp>0)?.hp`);
        await evaluate(host, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Strike'));c?.click();return !!c})()`);
        await until(guest, `window.__coopSnapshot.scene.enemies.find(e=>e.hp>0)?.hp<${Number(enemyHpBeforeSnapshot)}`, 'unrelated authoritative card-play snapshot');
        const focusAfterSnapshot = await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`);
        observed(focusAfterSnapshot === focusAfterMove, 'unrelated authoritative snapshot preserves the exact valid friendly target', `${focusAfterMove}→${focusAfterSnapshot}`);
        await evidenceCapture('stable-target', 'Unrelated ally action · chosen friendly target preserved');
        await padTap(1);
        const padCancel = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,focused:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Oath of Ash'))?.classList.contains('gp-focus'),lastKey:window.__friendlyPad.lastKey})`);
        observed(padCancel.targets === 0 && padCancel.focused === true, 'controller Cancel clears and restores card focus', JSON.stringify(padCancel));

        const beforeReboundPad = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
        await padTap(8);
        await until(guest, `!!document.querySelector('.flask-action-menu')`, 'rebound standard-pad Flask 1 menu');
        const afterReboundPad = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,actorId=s.party.find(p=>p.name==='Fenn')?.id,actor=s.scene.players.find(p=>p.id===actorId);return{hand:actor.hand.map(c=>c.instanceId).join(','),energy:actor.energy,ended:actor.ended,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
        observed(JSON.stringify(afterReboundPad) === JSON.stringify(beforeReboundPad), 'configured standard-pad binding synthesizes only the rebound Flask 1 action', `${JSON.stringify(beforeReboundPad)}→${JSON.stringify(afterReboundPad)}`);
        await padTap(1);
        await until(guest, `!document.querySelector('.flask-action-menu')`, 'rebound standard-pad Flask 1 menu closes');

        // Put the unified cursor on a self-only card through its public number
        // key, cancel it, then let the pad own arm + confirmation.
        const ironIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Iron Skin'))`);
        await key(guest, ironIndex === 9 ? 'q' : String(ironIndex + 1));
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'keyboard self-only arm');
        await key(guest, 'Escape');
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===0`, 'keyboard self-only cancel');
        await padTap(0);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'pad arms self-only card');
        await padTap(0);
        await until(guest, `![...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Iron Skin'))`, 'pad confirms one self target');
        const padCommit = await evaluate(guest, `(()=>{const s=window.__coopSnapshot.scene,actor=s.players.find(p=>p.id===${JSON.stringify(ids.actor)});return{targets:document.querySelectorAll('[data-friendly-target]').length,cards:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Iron Skin')).length,energy:actor?.energy,block:actor?.block}})()`);
        observed(padCommit.targets === 0 && padCommit.cards === 0 && padCommit.energy === 1 && padCommit.block === 8, 'controller Confirm commits exactly once and clears markers', JSON.stringify(padCommit));

        // At one energy Oath costs two. Number key, real pointer/touch and the
        // standard pad must all refuse to arm it, exactly as the server does.
        const unaffordableOathIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Oath of Ash'))`);
        const unaffordableOathKey = unaffordableOathIndex === 9 ? 'q' : String(unaffordableOathIndex + 1);
        await key(guest, unaffordableOathKey);
        await wait(250);
        const keyUnaffordable = await evaluate(guest, `(()=>{const s=window.__coopSnapshot.scene,actor=s.players.find(p=>p.id===${JSON.stringify(ids.actor)});return{targets:document.querySelectorAll('[data-friendly-target]').length,energy:actor?.energy,cards:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Oath of Ash')).length}})()`);
        observed(keyUnaffordable.targets === 0 && keyUnaffordable.energy === 1 && keyUnaffordable.cards === 1, 'number key refuses unaffordable friendly card without send/spend', JSON.stringify(keyUnaffordable));
        const oathSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Oath of Ash'));if(!c)return null;c.dataset.friendlyProbe='unaffordable-oath';return '[data-friendly-probe="unaffordable-oath"]'})()`);
        await activate(guest, oathSelector, shape.dpr > 1);
        await wait(250);
        observed((await evaluate(guest, `document.querySelectorAll('[data-friendly-target]').length`)) === 0, `${shape.dpr > 1 ? 'touch' : 'mouse'} refuses the same unaffordable friendly card`);
        // The three tool-seeded legacy flask buttons exist only for the
        // configured-binding controls above. Remove those fixture controls
        // before traversing the ordinary hand graph so this established pad
        // affordability check keeps measuring card navigation, not a larger
        // synthetic inventory. Pad Activate remains the product input door.
        await evaluate(guest, `document.querySelectorAll('[data-coop-flask-slot]').forEach((node)=>node.remove())`);
        // Put the controller cursor on the exact card under test. Directional
        // traversal is covered above; this cell isolates pad Activate's
        // affordability door from the tool-only legacy flask inventory.
        const oathPadFocused = await evaluate(guest, `(()=>{const card=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Oath of Ash'));if(!card)return false;document.querySelectorAll('.gp-focus').forEach((node)=>node.classList.remove('gp-focus'));card.classList.add('gp-focus');card.focus();return card.classList.contains('gp-focus')})()`);
        observed(oathPadFocused, 'controller cursor is on the unaffordable Oath card');
        if (oathPadFocused) await padTap(0);
        const padUnaffordable = await evaluate(guest, `(()=>{const s=window.__coopSnapshot.scene,actor=s.players.find(p=>p.id===${JSON.stringify(ids.actor)});return{targets:document.querySelectorAll('[data-friendly-target]').length,energy:actor?.energy,focused:document.querySelector('.hand .card.gp-focus')?.textContent.includes('Oath of Ash')===true}})()`);
        observed(oathPadFocused && padUnaffordable.targets === 0 && padUnaffordable.energy === 1 && padUnaffordable.focused, 'controller refuses unaffordable friendly card without send/spend', JSON.stringify(padUnaffordable));
        await evidenceCapture('unaffordable', 'Unaffordable Oath · no prompt or spend · exact card focus');

        // Three real seats: Wren has one HP, Vale remains legal. Arm the spare
        // ally card on focused Wren, then play Wren's tool-seeded Blood Pact
        // through the real server/engine path so Wren downs in its own live
        // snapshot while Fenn's origin card is still mounted. Losing the
        // focused target cancels instead of silently rehoming to Vale and
        // restores that exact originating card after the DOM rebuild.
        const spareSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));if(!c)return null;c.dataset.friendlyProbe='spare-banner';return '[data-friendly-probe="spare-banner"]'})()`);
        await activate(guest, spareSelector, shape.dpr > 1);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===2`, 'spare ally card arms across two legal allies');
        for (let move = 0; move < 4 && await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat!==${JSON.stringify(ids.ally)}`); move++) await padTap(14);
        observed((await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`)) === ids.ally, 'three-seat control focuses the ally that will become down');
        await until(host, `[...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Blood Pact'))`, 'ally self-down fixture card');
        await evaluate(host, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Blood Pact'));c?.click();return !!c})()`);
        await until(host, `document.querySelectorAll('[data-friendly-target]').length===1`, 'ally self-down target confirmation');
        await evaluate(host, click('[data-friendly-target]'));
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.ally)});return p?.alive===false})()`, 'focused ally becomes down through real engine play');
        const down = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,focusable:document.querySelectorAll('.coop-seat[data-focusable]').length,selected:[...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Rallying Banner')&&x.classList.contains('selected')),card:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'))?.classList.contains('gp-focus'),supportAlive:window.__coopSnapshot.scene.players.find(x=>x.id===${JSON.stringify(ids.support)})?.alive})`);
        observed(down.targets === 0 && down.focusable === 0 && down.selected === false && down.card === true && down.supportAlive === true, 'focused ally down cancels three-seat targeting and restores exact card focus while another ally remains', JSON.stringify(down));
        await evidenceCapture('down-cancel', 'Focused ally down · targeting canceled · origin focus restored');

        // Re-arm against the one remaining legal ally, then disconnect that
        // real client. Last-target invalidation owns the same exact focus return.
        const spareRearmSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));if(!c)return null;c.dataset.friendlyProbe='spare-rearm';return '[data-friendly-probe="spare-rearm"]'})()`);
        await activate(guest, spareRearmSelector, shape.dpr > 1);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'spare ally card re-arms on last legal ally');
        await cdp.send('Target.closeTarget', { targetId: support.targetId });
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.support)});return !p?.connected})()`, 'away teammate snapshot');
        const away = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,focusable:document.querySelectorAll('.coop-seat[data-focusable]').length,selected:[...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Rallying Banner')&&x.classList.contains('selected')),card:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'))?.classList.contains('gp-focus')})`);
        observed(away.targets === 0 && away.focusable === 0 && away.selected === false && away.card === true, 'last legal ally away clears target/AX/click state and restores exact card focus without spend', JSON.stringify(away));
        await evidenceCapture('away-cancel', 'Last ally away · target and AX cleared · origin focus restored');

        // Spend the final ordinary energy through a real hostile card. The
        // Ancestral Horn fixture must then keep a 1-cost Power server-legal at
        // zero energy through the exact same number/q, pointer/touch, and pad
        // input doors used above.
        const strikeBefore = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Strike')).length`);
        observed(strikeBefore > 0, 'fixture retains an ordinary one-energy hostile card for the zero-energy control', String(strikeBefore));
        if (strikeBefore > 0) {
          await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Strike'));c?.click();return !!c})()`);
          await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.actor)});return p?.energy===0&&[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Strike')).length<${Number(strikeBefore)}})()`, 'ordinary card spends final energy');
        }
        const hornStart = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.actor)});return{energy:p?.energy,relics:p?.relicIds,thorn:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length}})()`);
        observed(hornStart.energy === 0 && hornStart.relics?.includes('ancestralHorn') && hornStart.thorn >= 3, 'authoritative snapshot exposes Ancestral Horn with three Power controls at zero energy', JSON.stringify(hornStart));

        const hornIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Thorn Halo'))`);
        observed(hornIndex >= 0 && hornIndex <= 9, 'discounted Power is reachable by the product number/q shortcut', String(hornIndex));
        if (hornIndex >= 0 && hornIndex <= 9) {
          await key(guest, hornIndex === 9 ? 'q' : String(hornIndex + 1));
          await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'number/q arms Horn-discounted Power at zero energy');
          await evidenceCapture('discount-power', `Ancestral Horn · Thorn Halo at 0 energy · ${hornIndex === 9 ? 'q' : `number ${hornIndex + 1}`} arms self target`);
          await activate(guest, '[data-friendly-target]', shape.dpr > 1);
          await until(guest, `[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length===${Number(hornStart.thorn - 1)}`, 'number/q discounted Power server result');
        }
        const hornAfterKey = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.actor)});return{energy:p?.energy,thorn:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length,targets:document.querySelectorAll('[data-friendly-target]').length}})()`);
        observed(hornAfterKey.energy === 0 && hornAfterKey.thorn === hornStart.thorn - 1 && hornAfterKey.targets === 0, 'number/q sends and plays the Horn-discounted Power exactly once without energy spend', JSON.stringify(hornAfterKey));

        const thornPointer = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Thorn Halo'));if(!c)return null;c.dataset.friendlyProbe='horn-pointer';return '[data-friendly-probe="horn-pointer"]'})()`);
        observed(await activate(guest, thornPointer, shape.dpr > 1), `${shape.dpr > 1 ? 'touch' : 'mouse'} reaches the same Horn-discounted Power at zero energy`);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'pointer/touch arms Horn-discounted Power');
        await activate(guest, '[data-friendly-target]', shape.dpr > 1);
        await until(guest, `[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length===${Number(hornStart.thorn - 2)}`, 'pointer/touch discounted Power server result');

        const thornPadFocused = await evaluate(guest, `(()=>{const card=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Thorn Halo'));if(!card)return false;document.querySelectorAll('.gp-focus').forEach((node)=>node.classList.remove('gp-focus'));card.classList.add('gp-focus');card.focus();return card.classList.contains('gp-focus')})()`);
        observed(thornPadFocused, 'controller cursor is on the Horn-discounted Power at zero energy');
        if (thornPadFocused) await padTap(0);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'pad arms Horn-discounted Power');
        await padTap(0);
        await until(guest, `[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length===${Number(hornStart.thorn - 3)}`, 'pad discounted Power server result');
        const hornDone = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.actor)});return{energy:p?.energy,thorn:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Thorn Halo')).length,targets:document.querySelectorAll('[data-friendly-target]').length,ended:p?.ended}})()`);
        observed(hornDone.energy === 0 && hornDone.thorn === hornStart.thorn - 3 && hornDone.targets === 0 && hornDone.ended === false, 'number/q, pointer/touch, and pad each play one discounted Power with no rejection or double action', JSON.stringify(hornDone));
      } finally {
        await cdp.send('Target.closeTarget', { targetId: host.targetId }).catch(() => {});
        await cdp.send('Target.closeTarget', { targetId: guest.targetId }).catch(() => {});
        await cdp.send('Target.closeTarget', { targetId: support.targetId }).catch(() => {});
        server.server.closeAllConnections?.();
        await Promise.race([
          new Promise((resolve) => server.server.close(resolve)),
          wait(2000),
        ]);
      }
    }
  } finally {
    cdp.close();
    await closeBrowser();
  }
  if (findings.length) throw new Error(`browser parity failed (${findings.length}): ${findings.join('; ')}`);
}

if (process.argv.includes('--browser')) {
  try { await browserDoor(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
