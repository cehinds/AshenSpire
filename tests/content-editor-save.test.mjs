// The Game content API: path guard, JSON check, LF writes, stale saves and the check gate.
// Routes, messages, limits and file rules come from contentApi.json, so retuning needs no edit.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { TextHash as BrowserTextHash } from '../tools/score-studio/contentEditor/textHash.js';
import { CollectCheck, RunContentCheck } from '../tools/content-editor-check.mjs';
import { ApiMessage, CONTENT_API } from '../tools/content-editor-config.mjs';
import { CONTENT_STATUS } from '../tools/content-editor-error.mjs';
import {
    ListContentFolder,
    PrepareContentText,
    ResolveEditablePath,
    SaveContentFile,
} from '../tools/content-editor-files.mjs';
import { TextHash } from '../tools/content-editor-hash.mjs';
import { HandleContentRequest } from '../tools/content-editor-save.mjs';
import {
    FakeRequest,
    FakeResponse,
    StudioCheck,
    StudioPut,
    StudioRead,
} from './helpers/content-editor-requests.mjs';

const CORE_FOLDER = 'games/ashenspire/packs/core';
const ENEMY_FOLDER = `${CORE_FOLDER}/enemies`;
const ROUTES_PATH = `${CORE_FOLDER}/routes.json`;
const ORIGINAL_TEXT = '{\n  "maxBranches": 3\n}\n';
const ORIGINAL_HASH = TextHash(ORIGINAL_TEXT);
const SHEET_NAME = `huskBrute${CONTENT_API.listExtension}`;
const HIDDEN_NAME = `${CONTENT_API.hiddenPrefix}reference${CONTENT_API.listExtension}`;
const OTHER_NAME = 'notes.md';
const REMOTE_ADDRESS = '10.0.0.5';
const MILLISECONDS_PER_SECOND = 1000;
const SHORT_TIMEOUT_MS = 20;
const WORKER_EXIT_CODE = 1;
const WRITE_ON = {
    editorWrite: true,
};

const root = mkdtempSync(join(tmpdir(), 'content-editor-'));
mkdirSync(join(root, ENEMY_FOLDER), { recursive: true });
writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
for (const name of [SHEET_NAME, HIDDEN_NAME, OTHER_NAME])
{
    writeFileSync(join(root, ENEMY_FOLDER, name), '{}\n');
}

after(() =>
{
    rmSync(root, { recursive: true, force: true });
});

function readRoutes()
{
    return readFileSync(join(root, ROUTES_PATH), 'utf8');
}

function restoreRoutes()
{
    writeFileSync(join(root, ROUTES_PATH), ORIGINAL_TEXT);
}

function saveOf(text, baseHash = ORIGINAL_HASH)
{
    return {
        path: ROUTES_PATH,
        text,
        baseHash,
    };
}

async function handle(request, options = WRITE_ON)
{
    const response = FakeResponse();
    await HandleContentRequest(request, response, { root, ...options });
    return response;
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
        const expected = {
            status: CONTENT_STATUS.forbidden,
            message: ApiMessage('notRepoPath', { path: path.replace(/\\/g, '/') }),
        };
        assert.throws(() => ResolveEditablePath(root, path), expected, path);
    }
});

test('the path guard refuses code, generated and non-content files', () =>
{
    const refused = [
        'tools/serve.mjs',
        'src/content/index.js',
        `${ENEMY_FOLDER}/_reference.json`,
        'package.json',
    ];
    for (const path of refused)
    {
        const expected = {
            status: CONTENT_STATUS.forbidden,
            message: ApiMessage('notEditable', { path }),
        };
        assert.throws(() => ResolveEditablePath(root, path), expected, path);
    }
    assert.equal(ResolveEditablePath(root, ROUTES_PATH), join(root, ROUTES_PATH));
});

test('text that is not JSON is refused and the file is left alone', async () =>
{
    const badRequest = { status: CONTENT_STATUS.badRequest };
    assert.throws(() => PrepareContentText('{ "maxBranches": 3, }'), badRequest);
    await assert.rejects(SaveContentFile(root, ROUTES_PATH, '{ broken', ORIGINAL_HASH), badRequest);
    assert.equal(readRoutes(), ORIGINAL_TEXT);
});

test('a save writes LF line endings and one trailing newline', async () =>
{
    const crlfText = '{\r\n  "maxBranches": 4\r\n}\r\n\r\n';
    await SaveContentFile(root, ROUTES_PATH, crlfText, ORIGINAL_HASH);
    assert.equal(readRoutes(), '{\n  "maxBranches": 4\n}\n');
    restoreRoutes();
});

test('a folder list shows only editable JSON and skips generated files', async () =>
{
    assert.deepEqual(await ListContentFolder(root, ENEMY_FOLDER), [SHEET_NAME]);
    const forbidden = { status: CONTENT_STATUS.forbidden };
    await assert.rejects(ListContentFolder(root, 'tools'), forbidden);
    await assert.rejects(ListContentFolder(root, `${CORE_FOLDER}/../../..`), forbidden);
});

test('the API answers only with --editor-write on a local request', async () =>
{
    const notLocal = {
        ok: false,
        error: ApiMessage('notLocal'),
    };
    const withoutWrite = await handle(StudioRead(ROUTES_PATH), { editorWrite: false });
    assert.equal(withoutWrite.status, CONTENT_STATUS.forbidden);
    assert.deepEqual(withoutWrite.body, notLocal);
    const remote = await handle(StudioRead(ROUTES_PATH, { remoteAddress: REMOTE_ADDRESS }));
    assert.equal(remote.status, CONTENT_STATUS.forbidden);
    const allowed = await handle(StudioRead(ROUTES_PATH));
    assert.equal(allowed.status, CONTENT_STATUS.ok);
    assert.equal(allowed.body.text, ORIGINAL_TEXT);
});

test('a save must come from the Studio, pass the path guard and fit the size limit', async () =>
{
    const foreignRequest = FakeRequest({
        method: 'PUT',
        url: CONTENT_API.routes.file,
        body: '{}',
    });
    const foreign = await handle(foreignRequest);
    assert.equal(foreign.status, CONTENT_STATUS.forbidden);
    assert.equal(foreign.body.error, ApiMessage('notFromStudio'));
    const escaping = await handle(StudioPut({ path: '../x.json', text: '{}' }));
    assert.equal(escaping.status, CONTENT_STATUS.forbidden);
    const oversized = await handle(StudioPut(null, ' '.repeat(CONTENT_API.maxBodyBytes + 1)));
    assert.equal(oversized.status, CONTENT_STATUS.tooLarge);
    assert.equal(oversized.body.error, ApiMessage('tooLarge'));
    const saved = await handle(StudioPut(saveOf('{"maxBranches": 5}')));
    assert.equal(saved.status, CONTENT_STATUS.ok);
    assert.equal(readRoutes(), '{"maxBranches": 5}\n');
    restoreRoutes();
});

test('an unknown route answers with the configured message', async () =>
{
    const unknown = await handle(FakeRequest({ method: 'GET', url: `${CONTENT_API.prefix}nope` }));
    assert.equal(unknown.status, CONTENT_STATUS.notFound);
    assert.equal(unknown.body.error, ApiMessage('noSuchRoute'));
});

test('the check collects every step line and reports the result', () =>
{
    const stepLines = [
        'first line',
        'second line',
        'third line',
    ];
    const fakeSteps = (steps, workingDirectory, log) =>
    {
        assert.equal(workingDirectory, root);
        log(stepLines[0]);
        log(`${stepLines[1]}\n${stepLines[2]}`);
        return { ok: false };
    };
    assert.deepEqual(CollectCheck(root, fakeSteps), {
        ok: false,
        lines: stepLines,
    });
});

test('a save against a file changed since it was opened is refused as stale', async () =>
{
    const rebuilt = '{\n  "maxBranches": 3,\n  "rebuilt": true\n}\n';
    writeFileSync(join(root, ROUTES_PATH), rebuilt);
    const staleMessage = ApiMessage('staleFile', { path: ROUTES_PATH });
    await assert.rejects(SaveContentFile(root, ROUTES_PATH, '{"maxBranches": 9}', ORIGINAL_HASH), {
        status: CONTENT_STATUS.conflict,
        stale: true,
        message: staleMessage,
    });
    assert.equal(readRoutes(), rebuilt);
    const response = await handle(StudioPut(saveOf('{"maxBranches": 9}')));
    assert.equal(response.status, CONTENT_STATUS.conflict);
    assert.deepEqual(response.body, {
        ok: false,
        error: staleMessage,
        stale: true,
    });
    restoreRoutes();
});

test('while a check runs, a save waits for it and a second check is refused', async () =>
{
    let finishCheck;
    const runCheck = () => new Promise((resolve) =>
    {
        finishCheck = resolve;
    });
    const options = {
        ...WRITE_ON,
        runCheck,
    };
    const running = handle(StudioCheck(), options);
    await new Promise((resolve) => setImmediate(resolve));
    const waitingSave = handle(StudioPut(saveOf('{"maxBranches": 7}')), options);
    const second = await handle(StudioCheck(), options);
    assert.equal(second.status, CONTENT_STATUS.conflict);
    assert.equal(second.body.error, ApiMessage('checkBusy'));
    assert.equal(readRoutes(), ORIGINAL_TEXT);
    finishCheck({ ok: true, lines: [] });
    assert.equal((await running).status, CONTENT_STATUS.ok);
    assert.equal((await waitingSave).status, CONTENT_STATUS.ok);
    assert.equal(readRoutes(), '{"maxBranches": 7}\n');
    restoreRoutes();
});

class FakeWorker extends EventEmitter
{
    constructor()
    {
        super();
        this.terminated = false;
    }

    /** Like a real worker, a terminated one reports 'exit' afterwards. */
    terminate()
    {
        this.terminated = true;
        setImmediate(() => this.emit('exit', WORKER_EXIT_CODE));
    }
}

test('a check worker that exits without a result reports a failed check', async () =>
{
    const worker = new FakeWorker();
    const running = RunContentCheck(root, { createWorker: () => worker });
    worker.emit('exit', WORKER_EXIT_CODE);
    assert.deepEqual(await running, {
        ok: false,
        lines: [ApiMessage('checkStopped', { code: WORKER_EXIT_CODE })],
    });
});

test('a check worker that runs past the timeout is stopped and reported as failed', async () =>
{
    const worker = new FakeWorker();
    const result = await RunContentCheck(root, {
        createWorker: () => worker,
        timeoutMs: SHORT_TIMEOUT_MS,
    });
    const seconds = Math.round(SHORT_TIMEOUT_MS / MILLISECONDS_PER_SECOND);
    assert.deepEqual(result, {
        ok: false,
        lines: [ApiMessage('checkTimedOut', { seconds })],
    });
    assert.equal(worker.terminated, true);
});

test('the browser hash of a file text matches the server hash', async () =>
{
    const text = `${ORIGINAL_TEXT}é ·\n`;
    assert.equal(await BrowserTextHash(text, CONTENT_API.hash.web), TextHash(text));
});

test('two saves from the same opened text: the first writes, the second is stale', async () =>
{
    const saves = await Promise.allSettled([
        SaveContentFile(root, ROUTES_PATH, '{"maxBranches": 5}', ORIGINAL_HASH),
        SaveContentFile(root, ROUTES_PATH, '{"maxBranches": 6}', ORIGINAL_HASH),
    ]);
    assert.equal(saves[0].status, 'fulfilled');
    assert.equal(saves[1].status, 'rejected');
    assert.equal(saves[1].reason.status, CONTENT_STATUS.conflict);
    assert.equal(saves[1].reason.message, ApiMessage('staleFile', { path: ROUTES_PATH }));
    assert.equal(readRoutes(), '{"maxBranches": 5}\n');
    restoreRoutes();
});
