import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const frameworkFiles = [
    'package.json', 'tools/framework-data-build.mjs', 'tools/lib',
    'engine/kernel', 'engine/contracts/framework-combat-mechanics.schema.json',
    'content/framework',
];
const profileOutputs = [
    'games/ashenspire/game.lock.json',
    'src/content/generated/gameProfiles.js',
    'src/content/generated/baseCards.js',
];

function fixture(t, files)
{
    const root = mkdtempSync(resolve(tmpdir(), 'ashen-config-lifetimes-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const file of files)
    {
        const destination = resolve(root, file);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(resolve(repository, file), destination, { recursive: true });
    }
    return root;
}

function run(root, ...args)
{
    const result = spawnSync(process.execPath, args, {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, ASHEN_BUILD_LOCK_TOKEN: '' },
    });
    assert.ifError(result.error);
    return result;
}

function runOk(root, ...args)
{
    const result = run(root, ...args);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
}

function readJson(root, file)
{
    return JSON.parse(readFileSync(resolve(root, file), 'utf8'));
}

function writeJson(root, file, data)
{
    writeFileSync(resolve(root, file), JSON.stringify(data));
}

test('framework validation reports the authored field and leaves generated files alone', t =>
{
    const root = fixture(t, frameworkFiles);
    const source = 'content/framework/mechanics.json';
    const stock = readJson(root, source);
    const generated = resolve(root, 'src/framework/data');
    const invalid = [
        ['accuracy/evasionBase', data => { data.accuracy.evasionBase = '<overflow>'; }],
        ['accuracy/precisionDecayPerTurn', data => { delete data.accuracy.precisionDecayPerTurn; }],
        ['counter/stackFraction', data => { data.counter.stackFraction = -0.1; }],
        ['reflect/stackCap', data => { data.reflect.stackCap = 4.5; }],
        ['reflect/reduceCap', data => { data.reflect.reduceCap = 1.01; }],
    ];
    for (const [path, change] of invalid)
    {
        const candidate = structuredClone(stock);
        change(candidate);
        writeFileSync(resolve(root, source), JSON.stringify(candidate).replace('"<overflow>"', '1e999'));
        const result = run(root, 'tools/framework-data-build.mjs');
        assert.equal(result.status, 1, result.stdout);
        assert.ok(result.stderr.includes(`${source}/${path}:`), result.stderr);
        assert.equal(existsSync(generated), false, 'no generated directory for invalid input');
    }

    stock.accuracy.evasionBase = -2;
    stock.counter.stackFraction = 1.25;
    stock.reflect.stackCap = 0;
    writeJson(root, source, stock);
    runOk(root, 'tools/framework-data-build.mjs');
    runOk(root, '--permission', '--allow-fs-read=*', 'tools/framework-data-build.mjs', '--check');

    const firstOutput = resolve(generated, 'assets.js');
    const before = { bytes: readFileSync(firstOutput), mtime: statSync(firstOutput).mtimeMs };
    writeJson(root, 'content/framework/assets.json', { changed: true });

    const sourcePath = resolve(root, source);
    const renamedSource = sourcePath + '.disabled';
    renameSync(sourcePath, renamedSource);
    for (const args of [
        ['tools/framework-data-build.mjs'],
        ['--permission', '--allow-fs-read=*', 'tools/framework-data-build.mjs', '--check'],
    ])
    {
        const missing = run(root, ...args);
        assert.equal(missing.status, 1);
        assert.match(missing.stderr, /missing required source content\/framework\/mechanics\.json/);
        assert.deepEqual(readFileSync(firstOutput), before.bytes);
        assert.equal(statSync(firstOutput).mtimeMs, before.mtime);
    }
    renameSync(renamedSource, sourcePath);

    writeFileSync(resolve(root, 'content/framework/z-invalid.json'), '{');
    const result = run(root, 'tools/framework-data-build.mjs');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /content\/framework\/z-invalid\.json is not valid JSON/);
    assert.deepEqual(readFileSync(firstOutput), before.bytes);
    assert.equal(statSync(firstOutput).mtimeMs, before.mtime);
    assert.equal(existsSync(resolve(generated, 'z-invalid.js')), false);
});

test('framework tuning stays live across portable restore while each run keeps its profile and fight rules', t =>
{
    const root = fixture(t, [
        ...frameworkFiles.filter(file => !file.startsWith('engine/')),
        'engine', 'src', 'games/ashenspire', 'content/source',
        'tools/game-config.mjs', 'tools/base-cards.mjs', 'tools/catalog-json.mjs',
        'tests/helpers/config-lifetime-probe.mjs', 'tests/fixtures/dev-profile-73ef.json.gz',
    ]);
    const profileBuild = () => runOk(root, 'tools/game-config.mjs', 'build');
    const profileCheck = () => runOk(root, 'tools/game-config.mjs', 'check');
    const frameworkBuild = () => runOk(root, 'tools/framework-data-build.mjs');
    const profileBytes = (from = root) => profileOutputs.map(file => readFileSync(resolve(from, file)));
    const probe = mode => JSON.parse(runOk(root, 'tests/helpers/config-lifetime-probe.mjs', mode));

    frameworkBuild();
    profileBuild();
    profileCheck();
    const stock = profileBytes();
    assert.deepEqual(stock, profileBytes(repository));
    const saved = probe('save');
    assert.equal(saved.xp, 1);
    assert.equal(saved.freshAction, 2);
    assert.equal(saved.slots[0].pinned.profile, saved.profile);
    assert.notEqual(saved.slots[1].pinned.profile, saved.profile);
    assert.equal(saved.slots[1].pinned.action, 1);
    assert.equal(saved.slots[0].pinned.opening, 'Saved opening for slot 1');
    assert.equal(saved.slots[0].pinned.range.policy.reachPrecisionBonus, 3);
    assert.ok(saved.slots[0].pinned.fixCore);
    assert.ok(saved.slots[0].pinned.pendingReaction);
    assert.ok(Object.keys(saved.slots[0].pinned.rng).length > 0);

    const source = 'content/framework/mechanics.json';
    const tuned = readJson(root, source);
    tuned.accuracy.evasionBase += 2;
    tuned.counter.stackFraction = 0.2;
    tuned.reflect.stackCap = 4;
    writeJson(root, source, tuned);
    frameworkBuild();
    profileBuild();
    profileCheck();
    assert.deepEqual(profileBytes(), stock, 'live edits do not change any profile output');

    const bundle = 'games/ashenspire/bundles/core/bundle.json';
    const authored = readJson(root, bundle);
    authored.modules.progression.settings.classXpMultiplier = 2;
    writeJson(root, bundle, authored);
    profileBuild();
    const changed = profileBytes();
    profileBuild();
    profileCheck();
    assert.deepEqual(profileBytes(), changed, 'the same inputs compile to the same bytes');

    const restored = probe('restore');
    assert.equal(restored.runtime, saved.runtime);
    assert.notEqual(restored.profile, saved.profile);
    assert.equal(restored.xp, 2);
    assert.equal(restored.freshAction, 2);
    for (const [index, before] of saved.slots.entries())
    {
        const after = restored.slots[index];
        assert.deepEqual(after.pinned, before.pinned);
        assert.equal(before.live.counter, 9);
        assert.equal(before.live.reflect, 7);
        assert.deepEqual(after.live, { counter: 18, reflect: 4, evasion: before.live.evasion + 2 });
    }
});
