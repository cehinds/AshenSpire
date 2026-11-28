import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readText(relativePath)
{
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('shared modal head/foot and modal screens tighten spacing', () =>
{
    const kitCss = readText('../styles/kit.css');
    const uiCss = readText('../styles/ui.css');
    const polishCss = readText('../styles/player-polish.css');

    const headPattern = /\.modal-head,\s*\.as-head[\s\S]{0,200}padding:\s*0\.45rem var\(--modal-inset\)/;
    const footPattern = /\.modal-foot,\s*\.as-foot[\s\S]{0,200}padding:\s*0\.45rem var\(--modal-inset\)/;
    assert.match(kitCss, headPattern);
    assert.match(kitCss, footPattern);
    assert.match(kitCss, /\.armoury-position-card \.r-trail[\s\S]{0,80}flex-direction:\s*row/);
    assert.match(kitCss, /\.deck-view-modal \.modal-foot[\s\S]{0,40}display:\s*none/);

    assert.match(uiCss, /\.set-row-reset\[hidden\][\s\S]{0,40}display:\s*none !important/);
    assert.match(uiCss, /\.set-preview\s*\{[\s\S]{0,40}display:\s*none/);

    assert.match(polishCss, /\.merchant-category-dock[\s\S]{0,120}flex-wrap:\s*nowrap/);
    assert.match(polishCss, /\.class-pick > \.glyph[\s\S]{0,40}display:\s*none/);
});

test('card reward confirms in a modal, not an inline section', () =>
{
    const offersSrc = readText('../src/ui/components/gameProfileOffers.js');
    const kitCss = readText('../styles/kit.css');
    assert.match(offersSrc, /OpenConfirmationModal\(\{\s*title:\s*translate\(PICKS_CONFIRM_TITLE_KEY\)/);
    assert.doesNotMatch(offersSrc, /reward-inline-confirm/);
    assert.doesNotMatch(kitCss, /reward-inline-confirm/);
});
