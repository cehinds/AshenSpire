// Core 2 test helper (cleanup plan 3c). Core 2 (`ashen.core@2.0.0`, author `default`/`core`) is the only
// game profile, so tests that need the shipped game build their registries and runs through these
// functions instead of hand-rolling resolveGameProfile + bindGameProfileRegistries each time.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';

let cachedProfile = null;
let cachedRegistries = null;

/** The resolved, frozen Core 2 profile (`resolveGameProfile('default')`), resolved once per process. */
export function core2Profile() {
  return cachedProfile ||= resolveGameProfile('default');
}

/**
 * Registries bound to the Core 2 profile. With no argument the shared cached instance is returned
 * (do not mutate it). `overrides` is a plain object spread over a fresh bound copy, so a test can
 * swap one registry (for example `enemies`) without rebuilding the rest.
 */
export function core2Registries(overrides = null) {
  const profile = core2Profile();
  cachedRegistries ||= bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return overrides ? Object.freeze({ ...cachedRegistries, ...overrides }) : cachedRegistries;
}

/**
 * A fresh run state bound to the Core 2 profile. `opts` are createRunState options; `seed` defaults
 * to 73, `classId` to 'reaver', and `registries` to core2Registries().
 */
export function core2Run({ seed = 73, classId = 'reaver', registries = core2Registries(), ...rest } = {}) {
  return createRunState({ seed, classId, registries, ...rest });
}
