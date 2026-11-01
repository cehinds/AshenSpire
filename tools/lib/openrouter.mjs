// tools/lib/openrouter.mjs — server-side OpenRouter client for dev tooling.
//
// NEVER import this from src/: the game must not reference AI services
// (`node tools/ai-disclosure.mjs --check` enforces it). Browser UIs call a
// local server route that uses this module, never OpenRouter directly.
//
// The key comes from OPENROUTER_API_KEY in the shell, or from .env at the repo
// root (gitignored). It is never logged, returned, or placed in an error
// message: any text derived from a response is scrubbed first.
//
// Zero dependencies, Node core only (Node >= 22.14: global fetch, util.parseEnv).

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));
const MISSING_KEY = 'OPENROUTER_API_KEY is not set. Put it in your shell environment or in .env at the repo root (gitignored).';

export function openRouterKey({ env = process.env, envFile = DEFAULT_ENV_FILE } = {}) {
  if (env.OPENROUTER_API_KEY) return env.OPENROUTER_API_KEY;
  if (envFile && existsSync(envFile)) {
    const parsed = parseEnv(readFileSync(envFile, 'utf8'));
    if (parsed.OPENROUTER_API_KEY) return parsed.OPENROUTER_API_KEY;
  }
  throw new Error(MISSING_KEY);
}

function scrub(text, key) {
  let out = String(text ?? '');
  if (key) out = out.split(key).join('[redacted]');
  return out;
}

// Wrap the network call: a malformed key (say, a stray newline) makes fetch
// throw before any request, and its message quotes the header, key included.
async function send(fetchImpl, url, init, key) {
  try {
    return await fetchImpl(url, init);
  } catch (err) {
    throw new Error(scrub(`OpenRouter request failed: ${err?.message ?? err}`, key));
  }
}

async function failure(res, key) {
  let detail = res.statusText;
  try {
    const body = await res.json();
    if (body && body.error && body.error.message) detail = body.error.message;
  } catch { /* keep statusText */ }
  return new Error(scrub(`OpenRouter ${res.status}: ${detail}`, key));
}

export async function chat({
  messages, model, key, fetchImpl = fetch, signal, maxTokens, temperature,
  env = process.env,
} = {}) {
  const useModel = model || env.OPENROUTER_MODEL || 'openrouter/auto';
  const payload = { model: useModel, messages };
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;
  if (temperature !== undefined) payload.temperature = temperature;
  const res = await send(fetchImpl, `${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/cehinds/AshenSpire',
      'X-Title': 'AshenSpire dev tools',
    },
    body: JSON.stringify(payload),
    signal,
  }, key);
  if (!res.ok) throw await failure(res, key);
  const data = await res.json();
  return {
    text: scrub(data?.choices?.[0]?.message?.content ?? '', key),
    model: data?.model ?? useModel,
    usage: data?.usage,
  };
}

export async function verifyKey({ key, fetchImpl = fetch, signal } = {}) {
  const res = await send(fetchImpl, `${BASE}/key`, {
    headers: { Authorization: `Bearer ${key}` },
    signal,
  }, key);
  if (!res.ok) throw await failure(res, key);
  const { data } = await res.json();
  // No label: OpenRouter's default label is a truncated copy of the key.
  return { limit: data?.limit, usage: data?.usage };
}
