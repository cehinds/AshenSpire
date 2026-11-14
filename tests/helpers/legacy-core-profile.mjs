// The Core profile as it shipped before deck editing moved to rest sites: cards.editorWhere 'noncombat' (Armoury deck door)
// and the two unlimited training rules (Basics and Cantrips mint without limit). A run pins its profile, so old saves keep this.
import { readFileSync } from 'node:fs';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
const OLD_RULES = JSON.parse(readFileSync(new URL('../fixtures/legacy-core-unlimited-rules.json', import.meta.url), 'utf8'));
export const legacyCoreProfile = () => resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0',
  modules: { cards: { editorWhere: 'noncombat' }, 'deck-training': { unlimited: structuredClone(OLD_RULES) } } });
export const legacyCoreRegistries = (profile = legacyCoreProfile()) =>
  bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
