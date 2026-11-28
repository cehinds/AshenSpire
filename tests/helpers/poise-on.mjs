// Core ships Poise off (stagger.poise). Tests that pin Poise rules spread these modules into
// their Core profile to bring it back (tests/fixtures/simple-combat-flags.json, poiseOn).
import { readFileSync } from 'node:fs';

const FIXTURE_URL = new URL('../fixtures/simple-combat-flags.json', import.meta.url);
const FIXTURE = JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));

export const POISE_ON_MODULES = Object.freeze(FIXTURE.overrides.poiseOn);

/** The shipping Core author with Poise back on, for tests that resolved 'core' or 'default'. */
export const CORE_POISE_ON_AUTHOR = Object.freeze({
  formatVersion: 1,
  core: FIXTURE.core,
  modules: POISE_ON_MODULES,
});
