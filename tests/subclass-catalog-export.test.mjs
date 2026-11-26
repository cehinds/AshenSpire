import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, renameSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { ValidateSubclassCatalog, SerializeSubclassCatalog } from '../src/model/subclassCatalogExport.js';
import { saveStudioSubclassCatalog, SUBCLASS_CATALOG_PATH } from '../tools/score-studio-save.mjs';

const classes = ['reaver', 'rogue', 'starseer', 'herald'];
const makeCatalog = () => ({ formatVersion: 1, kind: 'ashenspire.subclassCatalog', seed: 'test', cards: [{
  id: 'subclass.bloodletter.serrated_cut', name: 'Serrated Cut', class: 'reaver', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', type: 'attack',
  effects: [{ op: 'damage', target: 'enemy', amount: 6 }], keywords: [], tags: ['camp:physical', 'maneuver:attack', 'classification.attack'],
  upgradeMenu: ['dmg'], textTemplate: 'Deal {damage} damage.', damageSchool: 'physical', exposureBuildupPerHit: 0,
}], lists: [{ id: 'bloodletter', classId: 'reaver', name: 'Bloodletter', cardIds: ['subclass.bloodletter.serrated_cut'] }] });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ashen-subclass-export-'));
  const put = (path, value) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value)); };
  for (const id of classes) put(`content/source/cards/${id}Cards.json`, [{ id: `original.${id}`, name: 'Preserved', class: id }]);
  put('content/source/classes.json', classes.map(id => ({ id, cardPool: [`original.${id}`] })));
  put('content/source/statuses.json', [{ id: 'bleed' }]); put('content/source/stances.json', [{ id: 'attack' }]); put('content/source/keywords.json', []);
  put('content/source/nodes.csv', 'id,parentId,label\ncard,,Card\ncamp:physical,card,Physical\nmaneuver:attack,card,Attack\nclassification.attack,card,Attack\n');
  put('content/source/familyNodes.csv', 'family,nodeId\ncard,card\neffect,card\n');
  put('content/source/tagging.csv', '# original comment\nfamily,scope,objectId,tagId\ncard,,original.reaver,camp:physical\n');
  put('content/source/cardExposure.csv', 'cardId,damageSchool,exposureBuildupPerHit\noriginal.reaver,physical,0\n');
  put('games/ashenspire/packs/core/cards.json', [{ id: 'core.original', class: 'colorless', name: 'Keep me' }]);
  put('games/ashenspire/packs/core/resourceVariants.json', { 'core.original': { none: { cost: 0 } } });
  return { root, put, get: path => readFileSync(join(root, path), 'utf8'), json: path => JSON.parse(readFileSync(join(root, path), 'utf8')), dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('portable catalog validates effects, predicates, upgrade grammar, class ownership and transient data', () => {
  assert.deepEqual(ValidateSubclassCatalog(makeCatalog()), []);
  for (const mutate of [
    c => { c.cards[0].effects[0].op = 'invented'; },
    c => { c.cards[0].effects[0].target = 'filesystem'; },
    c => { c.cards[0].effects[0].if = { p: 'invented' }; },
    c => { c.cards[0].upgradeMenu = ['fx:invented']; },
    c => { c.cards[0].upgrade = { effects: [{ op: 'damage', target: 'enemy', amount: 2, invented: true }] }; },
    c => { c.lists[0].classId = 'rogue'; },
    c => { c.cards[0].effects[0].amount = Infinity; },
    c => { c.cards[0].effects[0].script = 'attack'; },
    c => { c.cards[0]._custom = true; },
    c => { c.cards[0].effects[0].op = 'addCinders'; },
    c => { c.cards[0].comboHook = { on: 'healed', effects: [{ op: 'invented' }] }; },
    c => { c.cards[0].stanceTrigger = { stance: 'invented' }; },
    c => { c.cards[0].requirements = { arbitrary: true }; },
    c => { c.lists[0].id = 'unknown_style'; },
    c => { c.lists[0].id = 'saint'; },
    c => { c.cards[0].comboHook = { on: 'healed', effects: [{ op: 'loseHp', target: 'self', amount: 1, nonlethal: true }, { op: 'heal', target: 'self', amount: 1 }] }; },
  ]) { const catalog = makeCatalog(); mutate(catalog); assert.ok(ValidateSubclassCatalog(catalog).length, JSON.stringify(catalog)); }
  const draft = makeCatalog(); draft.cards[0]._custom = true;
  assert.equal(JSON.parse(SerializeSubclassCatalog(draft)).cards[0]._custom, undefined);
});

test('exporting a smaller selection preserves prior cards and list membership', () => {
  const f = fixture();
  try {
    const larger = makeCatalog();
    const extra = structuredClone(larger.cards[0]); extra.id = 'subclass.bloodletter.second_cut'; extra.name = 'Second Cut';
    larger.cards.push(extra); larger.lists[0].cardIds.push(extra.id);
    saveStudioSubclassCatalog(f.root, { catalog: larger, rebuild: false });
    saveStudioSubclassCatalog(f.root, { catalog: makeCatalog(), rebuild: false });
    const saved = f.json(SUBCLASS_CATALOG_PATH);
    assert.equal(saved.cards.length, 2);
    assert.equal(saved.lists[0].cardIds.length, 2);
    assert.ok(f.json('games/ashenspire/packs/core/cards.json').some(card => card.id === extra.id));
  } finally { f.dispose(); }
});

test('additive export preserves originals and makes cards reachable in both pipelines, idempotently', () => {
  const f = fixture();
  try {
    const result = saveStudioSubclassCatalog(f.root, { catalog: makeCatalog(), rebuild: false });
    assert.equal(result.cardCount, 1); assert.equal(result.listCount, 1); assert.deepEqual(result.rebuilt, []);
    const id = makeCatalog().cards[0].id;
    assert.deepEqual(f.json('games/ashenspire/packs/core/cards.json')[0], { id: 'core.original', class: 'colorless', name: 'Keep me' });
    assert.equal(f.json('games/ashenspire/packs/core/cards.json').find(c => c.id === id).class, 'reaver');
    assert.ok(f.json('content/source/classes.json').find(c => c.id === 'reaver').cardPool.includes(id));
    assert.ok(f.json('content/source/cards/reaverCards.json').some(c => c.id === id));
    assert.equal(f.json('content/source/cards/reaverCards.json').find(c => c.id === id).tags, undefined);
    assert.match(f.get('content/source/tagging.csv'), /# original comment/);
    assert.match(f.get('content/source/tagging.csv'), /card,,original.reaver,camp:physical/);
    assert.ok(f.json('games/ashenspire/packs/core/resourceVariants.json')[id].none);
    const before = new Map(result.paths.map(path => [path, f.get(path)]));
    saveStudioSubclassCatalog(f.root, { catalog: makeCatalog(), rebuild: false });
    for (const [path, text] of before) assert.equal(f.get(path), text, path);
    const changed = makeCatalog(); changed.cards[0].effects[0].amount = 8;
    saveStudioSubclassCatalog(f.root, { catalog: changed, rebuild: false });
    assert.equal(f.json('games/ashenspire/packs/core/cards.json').filter(c => c.id === id).length, 1);
    assert.equal(f.json('games/ashenspire/packs/core/cards.json').find(c => c.id === id).effects[0].amount, 8);
  } finally { f.dispose(); }
});

test('authored collisions and unknown status/tag references fail before any writes', () => {
  for (const scenario of ['collision', 'status', 'tag']) {
    const f = fixture();
    try {
      const catalog = makeCatalog();
      if (scenario === 'collision') f.put('games/ashenspire/packs/core/cards.json', [{ ...catalog.cards[0], name: 'Authored original' }]);
      if (scenario === 'status') catalog.cards[0].effects.push({ op: 'applyStatus', target: 'enemy', status: 'invented', stacks: 2 });
      if (scenario === 'tag') catalog.cards[0].tags.push('invented:tag');
      const before = f.get('games/ashenspire/packs/core/cards.json');
      assert.throws(() => saveStudioSubclassCatalog(f.root, { catalog, rebuild: false }), /collides|Invalid subclass/);
      assert.equal(f.get('games/ashenspire/packs/core/cards.json'), before);
      assert.equal(existsSync(join(f.root, SUBCLASS_CATALOG_PATH)), false);
    } finally { f.dispose(); }
  }
});

test('failed builder rolls back source bytes and existing generated artifacts, removes newly generated files', () => {
  const f = fixture();
  try {
    f.put('src/content/generated/existing.js', 'original generated bytes');
    f.put('tools/content-build.mjs', "import {writeFileSync} from 'node:fs'; writeFileSync('src/content/generated/existing.js','changed'); writeFileSync('src/content/generated/new.js','created'); process.stderr.write('deliberate build failure'); process.exit(1);");
    const before = f.get('content/source/classes.json'), core = f.get('games/ashenspire/packs/core/cards.json');
    assert.throws(() => saveStudioSubclassCatalog(f.root, { catalog: makeCatalog() }), /rolled back.*deliberate build failure/);
    assert.equal(f.get('content/source/classes.json'), before);
    assert.equal(f.get('games/ashenspire/packs/core/cards.json'), core);
    assert.equal(f.get('src/content/generated/existing.js'), 'original generated bytes');
    assert.equal(existsSync(join(f.root, 'src/content/generated/new.js')), false);
    assert.equal(existsSync(join(f.root, SUBCLASS_CATALOG_PATH)), false);
  } finally { f.dispose(); }
});

test('a dangling catalog symlink cannot create a file outside the repository', t => {
  const f=fixture(), outside=mkdtempSync(join(tmpdir(),'ashen-subclass-outside-'));
  try {
    const target=join(outside,'not-created.json'), link=join(f.root,SUBCLASS_CATALOG_PATH);
    try { symlinkSync(target,link,'file'); }
    catch(error) { if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip(`File symlinks unavailable: ${error.code}`);return;}throw error; }
    assert.equal(existsSync(link),false);assert.equal(lstatSync(link).isSymbolicLink(),true);
    const before=f.get('games/ashenspire/packs/core/cards.json');
    assert.throws(()=>saveStudioSubclassCatalog(f.root,{catalog:makeCatalog(),rebuild:false}),/symbolic-link/);
    assert.equal(existsSync(target),false);assert.equal(f.get('games/ashenspire/packs/core/cards.json'),before);
  } finally {
    assert.ok(resolve(f.root).startsWith(resolve(tmpdir())+sep));assert.ok(resolve(outside).startsWith(resolve(tmpdir())+sep));
    f.dispose();rmSync(outside,{recursive:true,force:true});
  }
});

test('an outbound directory junction is rejected before a missing catalog or any source write', () => {
  const f=fixture(), outside=mkdtempSync(join(tmpdir(),'ashen-subclass-junction-'));
  try {
    const cards=join(f.root,'content/source/cards'), backup=join(f.root,'content/source/cards-original');
    renameSync(cards,backup);symlinkSync(outside,cards,process.platform==='win32'?'junction':'dir');
    const before=f.get('games/ashenspire/packs/core/cards.json');
    assert.throws(()=>saveStudioSubclassCatalog(f.root,{catalog:makeCatalog(),rebuild:false}),/symbolic-link|outside the repository/);
    assert.equal(f.get('games/ashenspire/packs/core/cards.json'),before);assert.equal(existsSync(join(f.root,SUBCLASS_CATALOG_PATH)),false);
    assert.equal(existsSync(join(outside,'reaverCards.json')),false);
  } finally {
    assert.ok(resolve(f.root).startsWith(resolve(tmpdir())+sep));assert.ok(resolve(outside).startsWith(resolve(tmpdir())+sep));
    f.dispose();rmSync(outside,{recursive:true,force:true});
  }
});
