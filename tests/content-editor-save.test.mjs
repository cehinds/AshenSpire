// The Score Studio "Game content" API: path guard, JSON check, LF writes and the localhost gate.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { CollectCheck, RunContentCheck } from '../tools/content-editor-check.mjs';
import {
    ListContentFolder,
    PrepareContentText,
    ResolveEditablePath,
    SaveContentFile,
    TextHash,
} from '../tools/content-editor-files.mjs';
import { HandleContentRequest } from '../tools/content-editor-save.mjs';

const CORE_FOLDER = 'games/ashenspire/packs/core';
const ENEMY_FOLDER = `${CORE_FOLDER}/enemies`;
const ROUTES_PATH = `${CORE_FOLDER}/routes.json`;
const ORIGINAL_TEXT = '{\n  "maxBranches": 3\n}\n';
const LOCAL_HOST = 'localhost:8094';
const LOOPBACK = '127.0.0.1';
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_CONFLICT = 409;
const ORIGINAL_HASH = TextHash(ORIGINAL_TEXT);

const root = mkdtempSync(join(tmpdir(), 'content-editor-'));
mkdirSync(join(root, ENEMY_FOLDER), { recursive: true });
writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
writeFileSync(join(root, ENEMY_FOLDER, 'huskBrute.json'), '{}\n');
writeFileSync(join(root, ENEMY_FOLDER, '_reference.json'), '{}\n');
writeFileSync(join(root, ENEMY_FOLDER, 'notes.md'), 'notes\n');

after(() =>
{
    rmSync(root, { recursive: true, force: true });
});

function readRoutes()
{
    return readFileSync(join(root, ROUTES_PATH), 'utf8');
}

function fakeRequest({ method, url, body = '', headers = {}, remoteAddress = LOOPBACK })
{
    return {
        method,
        url,
        socket: { remoteAddress },
        headers: {
            host: LOCAL_HOST,
            ...headers,
        },
        async *[Symbol.asyncIterator]()
        {
            yield Buffer.from(body);
        },
    };
}

function fakeResponse()
{
    return {
        status: 0,
        body: null,
        writeHead(status)
        {
            this.status = status;
        },
        end(text)
        {
            this.body = JSON.parse(text);
        },
    };
}

function studioPut(value)
{
    return fakeRequest({
        method: 'PUT',
        url: '/__content/file',
        body: JSON.stringify(value),
        headers: {
            origin: `http://${LOCAL_HOST}`,
            'content-type': 'application/json',
        },
    });
}

test('the path guard refuses paths that climb out of the repo', () =>
{
    const climbing = [
        '../secret.json',
        `${CORE_FOLDER}/../../../../secret.json`,
        '..\\secret.json',
        '/etc/passwd.json',
    ];
    for (const path of climbing)
    {
        assert.throws(() => ResolveEditablePath(root, path), { status: STATUS_FORBIDDEN }, path);
    }
});

test('the path guard refuses code, generated and non-content files', () =>
{
    const refused = [
        'tools/serve.mjs',
        'src/content/index.js',
        `${ENEMY_FOLDER}/_reference.json`,
        'package.json',
        '',
    ];
    for (const path of refused)
    {
        assert.throws(() => ResolveEditablePath(root, path), { status: STATUS_FORBIDDEN }, path);
    }
    assert.equal(ResolveEditablePath(root, ROUTES_PATH), join(root, ROUTES_PATH));
});

test('text that is not JSON is refused and the file is left alone', async () =>
{
    const badRequest = { status: STATUS_BAD_REQUEST };
    assert.throws(() => PrepareContentText('{ "maxBranches": 3, }'), badRequest);
    const broken = SaveContentFile(root, ROUTES_PATH, '{ broken', ORIGINAL_HASH);
    await assert.rejects(broken, badRequest);
    assert.equal(readRoutes(), ORIGINAL_TEXT);
});

test('a save writes LF line endings and one trailing newline', async () =>
{
    const crlfText = '{\r\n  "maxBranches": 4\r\n}\r\n\r\n';
    await SaveContentFile(root, ROUTES_PATH, crlfText, ORIGINAL_HASH);
    assert.equal(readRoutes(), '{\n  "maxBranches": 4\n}\n');
    writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
});

test('a folder list shows only editable JSON and skips generated files', async () =>
{
    assert.deepEqual(await ListContentFolder(root, ENEMY_FOLDER), ['huskBrute.json']);
    await assert.rejects(ListContentFolder(root, 'tools'), { status: STATUS_FORBIDDEN });
    const climbing = `${CORE_FOLDER}/../../..`;
    await assert.rejects(ListContentFolder(root, climbing), { status: STATUS_FORBIDDEN });
});

test('the API answers only with --editor-write on a local request', async () =>
{
    const read = () => fakeRequest({ method: 'GET', url: `/__content/file?path=${ROUTES_PATH}` });
    const withoutWrite = fakeResponse();
    await HandleContentRequest(read(), withoutWrite, { root, editorWrite: false });
    assert.equal(withoutWrite.status, STATUS_FORBIDDEN);
    const remote = fakeResponse();
    const remoteRequest = fakeRequest({
        method: 'GET',
        url: '/__content/file',
        remoteAddress: '10.0.0.5',
    });
    await HandleContentRequest(remoteRequest, remote, { root, editorWrite: true });
    assert.equal(remote.status, STATUS_FORBIDDEN);
    const allowed = fakeResponse();
    await HandleContentRequest(read(), allowed, { root, editorWrite: true });
    assert.equal(allowed.status, STATUS_OK);
    assert.equal(allowed.body.text, ORIGINAL_TEXT);
});

test('a save must come from the Studio page and pass the path guard', async () =>
{
    const foreign = fakeResponse();
    const foreignRequest = fakeRequest({
        method: 'PUT',
        url: '/__content/file',
        body: '{}',
    });
    await HandleContentRequest(foreignRequest, foreign, { root, editorWrite: true });
    assert.equal(foreign.status, STATUS_FORBIDDEN);
    const escaping = fakeResponse();
    const escapingRequest = studioPut({ path: '../x.json', text: '{}' });
    await HandleContentRequest(escapingRequest, escaping, { root, editorWrite: true });
    assert.equal(escaping.status, STATUS_FORBIDDEN);
    const saved = fakeResponse();
    const change = {
        path: ROUTES_PATH,
        text: '{"maxBranches": 5}',
        baseHash: ORIGINAL_HASH,
    };
    await HandleContentRequest(studioPut(change), saved, { root, editorWrite: true });
    assert.equal(saved.status, STATUS_OK);
    assert.equal(readRoutes(), '{"maxBranches": 5}\n');
    writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
});

test('the check collects every step line and reports the result', () =>
{
    const fakeSteps = (steps, workingDirectory, log) =>
    {
        assert.equal(workingDirectory, root);
        log('ok   Build content tables');
        log('FAIL Check card limits\ncore.x has 5 effects.');
        return { ok: false };
    };
    const result = CollectCheck(root, fakeSteps);
    assert.equal(result.ok, false);
    assert.deepEqual(result.lines, [
        'ok   Build content tables',
        'FAIL Check card limits',
        'core.x has 5 effects.',
    ]);
});

test('a save against a file changed since it was opened is refused as stale', async () =>
{
    const rebuilt = '{\n  "maxBranches": 3,\n  "rebuilt": true\n}\n';
    writeFileSync(join(root, ROUTES_PATH), rebuilt);
    const stale = SaveContentFile(root, ROUTES_PATH, '{"maxBranches": 9}', ORIGINAL_HASH);
    await assert.rejects(stale, {
        status: STATUS_CONFLICT,
        stale: true,
    });
    assert.equal(readRoutes(), rebuilt);
    const response = fakeResponse();
    const change = {
        path: ROUTES_PATH,
        text: '{"maxBranches": 9}',
        baseHash: ORIGINAL_HASH,
    };
    await HandleContentRequest(studioPut(change), response, { root, editorWrite: true });
    assert.equal(response.status, STATUS_CONFLICT);
    assert.equal(response.body.stale, true);
    assert.match(response.body.error, /routes\.json changed on disk/);
    writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
});

function studioCheck()
{
    return fakeRequest({
        method: 'POST',
        url: '/__content/check',
        body: '{}',
        headers: {
            origin: `http://${LOCAL_HOST}`,
            'content-type': 'application/json',
        },
    });
}

test('while a check runs, saves and a second check are refused', async () =>
{
    let finishCheck;
    const runCheck = () => new Promise((resolve) =>
    {
        finishCheck = resolve;
    });
    const options = {
        root,
        editorWrite: true,
        runCheck,
    };
    const checkResponse = fakeResponse();
    const running = HandleContentRequest(studioCheck(), checkResponse, options);
    await new Promise((resolve) => setImmediate(resolve));
    const save = fakeResponse();
    const change = {
        path: ROUTES_PATH,
        text: '{"maxBranches": 7}',
        baseHash: ORIGINAL_HASH,
    };
    await HandleContentRequest(studioPut(change), save, options);
    assert.equal(save.status, STATUS_CONFLICT);
    assert.match(save.body.error, /check is running/);
    const second = fakeResponse();
    await HandleContentRequest(studioCheck(), second, options);
    assert.equal(second.status, STATUS_CONFLICT);
    finishCheck({ ok: true, lines: [] });
    await running;
    assert.equal(checkResponse.status, STATUS_OK);
    assert.equal(readRoutes(), ORIGINAL_TEXT);
    const afterCheck = fakeResponse();
    await HandleContentRequest(studioPut(change), afterCheck, options);
    assert.equal(afterCheck.status, STATUS_OK);
    writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
});

class FakeWorker extends EventEmitter
{
    constructor()
    {
        super();
        this.terminated = false;
    }

    terminate()
    {
        this.terminated = true;
    }
}

test('a check worker that exits without a result reports a failed check', async () =>
{
    const worker = new FakeWorker();
    const running = RunContentCheck(root, { createWorker: () => worker });
    worker.emit('exit', 1);
    const result = await running;
    assert.equal(result.ok, false);
    assert.match(result.lines[0], /^FAIL .*exit code 1/);
});

test('a check worker that runs past the timeout is stopped and reported as failed', async () =>
{
    const worker = new FakeWorker();
    const result = await RunContentCheck(root, {
        createWorker: () => worker,
        timeoutMs: 20,
    });
    assert.equal(result.ok, false);
    assert.equal(worker.terminated, true);
    assert.match(result.lines[0], /^FAIL .*took longer than/);
});

test('the browser hash of a file text matches the server hash', async () =>
{
    const { ContentApi } = await import('../tools/score-studio/contentEditor/contentApi.js');
    const { CONTENT_API } = await import('../tools/content-editor-config.mjs');
    const api = new ContentApi(CONTENT_API);
    const text = `${ORIGINAL_TEXT}é ·\n`;
    assert.equal(await api.Hash(text), TextHash(text));
});
