// tests/openrouter.test.mjs — tools/lib/openrouter.mjs against a fake fetch (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRouterKey, chat, verifyKey } from '../tools/lib/openrouter.mjs';

const KEY = 'sk-or-test-SECRET123';
const reply = (body, init = {}) => ({
  ok: init.status === undefined || (init.status >= 200 && init.status < 300),
  status: init.status ?? 200,
  statusText: init.statusText ?? 'OK',
  json: async () => body,
});
const recorder = (response) => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return response; };
  return { calls, fetchImpl };
};
const ok = { model: 'x/y', choices: [{ message: { content: 'hello' } }], usage: { total_tokens: 3 } };

test('chat sends the documented request', async () => {
  const { calls, fetchImpl } = recorder(reply(ok));
  const messages = [{ role: 'user', content: 'hi' }];
  const out = await chat({ messages, key: KEY, fetchImpl, env: {}, maxTokens: 50, temperature: 0.2 });
  assert.deepEqual(out, { text: 'hello', model: 'x/y', usage: { total_tokens: 3 } });
  const { url, opts } = calls[0];
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.equal(opts.headers['HTTP-Referer'], 'https://github.com/cehinds/AshenSpire');
  assert.equal(opts.headers['X-Title'], 'AshenSpire dev tools');
  assert.deepEqual(JSON.parse(opts.body), { model: 'openrouter/auto', messages, max_tokens: 50, temperature: 0.2 });
});

test('model defaults to openrouter/auto, OPENROUTER_MODEL overrides, explicit wins', async () => {
  const body = async (args) => {
    const { calls, fetchImpl } = recorder(reply(ok));
    await chat({ messages: [], key: KEY, fetchImpl, ...args });
    return JSON.parse(calls[0].opts.body).model;
  };
  assert.equal(await body({ env: {} }), 'openrouter/auto');
  assert.equal(await body({ env: { OPENROUTER_MODEL: 'a/b' } }), 'a/b');
  assert.equal(await body({ env: { OPENROUTER_MODEL: 'a/b' }, model: 'c/d' }), 'c/d');
});

test('key comes from env, then from an env file, else throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'or-'));
  try {
    const envFile = join(dir, '.env');
    assert.equal(openRouterKey({ env: { OPENROUTER_API_KEY: 'from-env' }, envFile }), 'from-env');
    writeFileSync(envFile, '# c\nOPENROUTER_API_KEY="from-file"\n');
    assert.equal(openRouterKey({ env: {}, envFile }), 'from-file');
    assert.equal(openRouterKey({ env: { OPENROUTER_API_KEY: 'from-env' }, envFile }), 'from-env');
    assert.throws(
      () => openRouterKey({ env: {}, envFile: join(dir, 'missing.env') }),
      { message: 'OPENROUTER_API_KEY is not set. Put it in your shell environment or in .env at the repo root (gitignored).' },
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a 401 whose body echoes the key never leaks it', async () => {
  const { fetchImpl } = recorder(reply({ error: { message: `Invalid key ${KEY} rejected` } }, { status: 401, statusText: 'Unauthorized' }));
  await assert.rejects(chat({ messages: [], key: KEY, fetchImpl, env: {} }), (err) => {
    assert.match(err.message, /^OpenRouter 401: /);
    assert.ok(!err.message.includes(KEY));
    assert.ok(err.message.includes('[redacted]'));
    return true;
  });
});

test('non-2xx with unparseable body falls back to statusText', async () => {
  const res = { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new Error('no json'); } };
  await assert.rejects(chat({ messages: [], key: KEY, fetchImpl: async () => res, env: {} }), { message: 'OpenRouter 502: Bad Gateway' });
});

test('verifyKey returns label/limit/usage only', async () => {
  const { calls, fetchImpl } = recorder(reply({ data: { label: 'dev', limit: 10, usage: 1.5, extra: 'x' } }));
  const out = await verifyKey({ key: KEY, fetchImpl });
  assert.deepEqual(out, { label: 'dev', limit: 10, usage: 1.5 });
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/key');
  assert.ok(!JSON.stringify(out).includes(KEY));
});
