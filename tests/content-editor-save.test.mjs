// The Score Studio "Game content" API: path guard, JSON check, LF writes and the localhost gate.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { CollectCheck } from '../tools/content-editor-check.mjs';
import {
    ListContentFolder,
    PrepareContentText,
    ResolveEditablePath,
    SaveContentFile,
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
    await assert.rejects(SaveContentFile(root, ROUTES_PATH, '{ broken'), badRequest);
    assert.equal(readRoutes(), ORIGINAL_TEXT);
});

test('a save writes LF line endings and one trailing newline', async () =>
{
    await SaveContentFile(root, ROUTES_PATH, '{\r\n  "maxBranches": 4\r\n}\r\n\r\n');
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
    const change = { path: ROUTES_PATH, text: '{"maxBranches": 5}' };
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
