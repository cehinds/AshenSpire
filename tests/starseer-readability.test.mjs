import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { illustratedCardHtml } from '../src/ui/components/illustratedCard.js';
import { alternativeBackdropHtml } from '../src/ui/alternativeArt.js';

const registries = createRegistries(contentBundle);

test('card body rules text uses readable theme token instead of dark #291f16', () =>
{
    const model = playingCardModel(registries, { cardId: 'strike' });
    const html = illustratedCardHtml(model, { rules: 'Deal 6 damage.' });
    assert.match(html, /data-card-binding="rules"[^>]*color:var\(--parchment\)/);
    assert.doesNotMatch(html, /data-card-binding="rules"[^>]*color:#291f16/i);
});

test('combat stage omits the 64px Card placeholder and hides failed backdrop images', () =>
{
    const stagePath = new URL('../src/ui/alternativeCardStage.js', import.meta.url);
    const stageSrc = readFileSync(stagePath, 'utf8');
    assert.doesNotMatch(stageSrc, /card\.artPlaceholder/);
    assert.doesNotMatch(stageSrc, /font-size:64px/);

    const backdrop = alternativeBackdropHtml('hollow-weald-1');
    assert.match(backdrop, /onerror="this\.setAttribute\('display','none'\)"/);
});
