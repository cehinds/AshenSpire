import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { applyGameProfileToContent, resolveGameProfile } from '../src/model/gameProfile.js';
import { CardInspectorFlavor } from '../src/ui/components/card.js';
import { armouryStatsModel } from '../src/ui/models/ArmouryStatsModel.js';
import { staticCardTokens } from '../src/model/playingCard.js';

const FIXTURE_TEXT = 'Core adapter fixture. Values are provisional and authored in cards.json.';
const LORE_TEXT = 'Forged in the ash of the first kiln.';

test('CardInspectorFlavor hides dev fixture flavor outside dev builds', () =>
{
    assert.equal(CardInspectorFlavor(FIXTURE_TEXT, 'dev'), FIXTURE_TEXT);
    assert.equal(CardInspectorFlavor(FIXTURE_TEXT, 'test'), '');
    assert.equal(CardInspectorFlavor(FIXTURE_TEXT, 'release'), '');
    assert.equal(CardInspectorFlavor(FIXTURE_TEXT, 'main'), '');
    assert.equal(CardInspectorFlavor(FIXTURE_TEXT, 'unknown'), '');
    assert.equal(CardInspectorFlavor(LORE_TEXT, 'release'), LORE_TEXT);
    assert.equal(CardInspectorFlavor('', 'dev'), '');
});

test('Core 2 Starseer deck view passes run rules and hides x0 equipment card entries', () =>
{
    const profile = resolveGameProfile('core');
    const registries = createRegistries(applyGameProfileToContent(contentBundle, profile));
    const run = createRunState({
        seed: 1,
        classId: 'starseer',
        registries,
        gameProfile: profile,
        profileMeta: {
            gameProfileUnlocks: {
                core: {
                    completedRunIds: ['r1', 'r2', 'r3'],
                },
            },
        },
    });
    const model = armouryStatsModel({ registries, run });
    assert.equal(model.equipmentCardsSummary.includes('x0'), false);

    const strikeInst = run.deck.find((card) =>
    {
        return registries.cards.get(card.cardId)?.name === 'Arcane Strike';
    });
    assert.ok(strikeInst, 'Starseer starter deck includes Arcane Strike');
    const strikeDef = registries.cards.get(strikeInst.cardId);
    const withRules = staticCardTokens(strikeDef, registries, run);
    const withoutRules = staticCardTokens(strikeDef, registries, null);
    assert.notEqual(
        withRules.damage,
        withoutRules.damage,
        'passing run rules applies Core scaling instead of raw authored numbers',
    );

    const equipmentPath = new URL('../src/ui/screens/equipment.js', import.meta.url);
    const equipmentSrc = readFileSync(equipmentPath, 'utf8');
    assert.match(equipmentSrc, /openPileModal\(registries,[\s\S]{0,120}rules:\s*run/);
    const mainPath = new URL('../src/main.js', import.meta.url);
    const mainSrc = readFileSync(mainPath, 'utf8');
    assert.match(mainSrc, /openPileModal\(registries,[\s\S]{0,120}rules:\s*run/);
});
