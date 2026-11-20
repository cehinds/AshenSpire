// tests/perf-lite-css.test.mjs — styles/perf-lite.css is the Lite rendering budget
// (no filters, blends or backdrop filters). It must be wired in last, so it beats
// the other sheets, and it must stay Lite-only so Full is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { stripCssComments } from '../tools/css-strip.mjs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const hrefs = [...index.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
const rawCss = stripCssComments(readFileSync(new URL('../styles/perf-lite.css', import.meta.url), 'utf8'));
// @keyframes steps are not selectors.
const css = rawCss.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

test('perf-lite.css exists and is the last stylesheet before the generated HUD sheet, which stays last', () => {
  assert.ok(existsSync(new URL('../styles/perf-lite.css', import.meta.url)));
  assert.deepEqual(hrefs.slice(-2), ['styles/perf-lite.css', 'styles/hud-layout.generated.css']);
  assert.equal(hrefs.filter((h) => h === 'styles/perf-lite.css').length, 1);
});

// Every selector is either phone Lite (the Auto rule) or forced by a Blur / Shadows
// Off flag the player chose (owner, 2026-11-20). Nothing else reaches desktop.
const PHONE_LITE = ":is([data-layout='narrow'], [data-form-factor='mobile'])";
const FORCED_OFF = /^:root:root(:root)?\[data-fx-(blur|shadows)='off'\]/;
const rulesOf = (text) => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1].trim().split(/,\s*(?![^()]*\))/).map((sel) => sel.trim()), body: m[2] }));

test('every rule in perf-lite.css is phone Lite, or forced by a Blur or Shadows Off choice (desktop Auto is unchanged)', () => {
  const rules = rulesOf(css);
  assert.ok(rules.length > 10);
  for (const { selectors } of rules) {
    for (const sel of selectors) {
      if (FORCED_OFF.test(sel)) {
        assert.ok(!sel.includes("data-effects='off'") && !sel.includes(PHONE_LITE), `a forced-off rule is not device-scoped: ${sel}`);
        continue;
      }
      assert.match(sel, /^:root(:root)?\[data-effects='off'\]/, `not Lite-scoped: ${sel}`);
      assert.ok(sel.includes(PHONE_LITE), `not phone-scoped: ${sel}`);
    }
  }
});

test('Blur and Shadows split the phone rules: On exempts a phone, Off reaches every device', () => {
  const rules = rulesOf(css);
  const kindOf = ({ selectors, body }) => /backdrop-filter/.test(body) ? 'blur'
    : /mix-blend-mode/.test(body) || selectors.some((sel) => sel.includes('data-art-background-color')) ? null
    : selectors.some((sel) => sel.includes('aim-silho')) ? 'blur' : 'shadows';
  const forcedSeen = { blur: 0, shadows: 0 };
  for (const rule of rules) {
    const kind = kindOf(rule);
    const phone = rule.selectors.filter((sel) => !FORCED_OFF.test(sel));
    const forced = rule.selectors.filter((sel) => FORCED_OFF.test(sel));
    if (!kind) {
      assert.equal(forced.length, 0, `blends stay phone Lite only: ${rule.selectors[0]}`);
      for (const sel of phone) assert.ok(!sel.includes('data-fx-'), sel);
      continue;
    }
    for (const sel of phone) assert.ok(sel.includes(`${PHONE_LITE}:not([data-fx-${kind}='on'])`), `On must exempt a phone: ${sel}`);
    for (const sel of forced) assert.ok(sel.includes(`[data-fx-${kind}='off']`), `wrong flag: ${sel}`);
    if (phone.length) assert.equal(forced.length, phone.length, `every phone selector has its forced-off twin: ${phone[0]}`);
    forcedSeen[kind] += forced.length;
  }
  assert.ok(forcedSeen.blur >= 4 && forcedSeen.shadows >= 10, JSON.stringify(forcedSeen));
  // Off on desktop: the filter and backdrop resets carry no Lite or phone scope.
  assert.match(css, /:root:root\[data-fx-shadows='off'\] \*:not\(#lite-nofilter\)[^{]*\{\s*filter: none !important;/);
  assert.match(css, /:root:root\[data-fx-blur='off'\] \*:not\(#lite-nofilter\)[^{]*\{\s*backdrop-filter: none !important;/);
  assert.match(css, /:root:root\[data-fx-blur='off'\] \.aim-silho:not\(#lite-nofilter\) \{ filter: none !important; \}/);
});

test('perf-lite.css never adds a filter, backdrop filter or blend of its own', () => {
  for (const m of css.matchAll(/(^|[;{\s])(filter|backdrop-filter|mix-blend-mode)\s*:\s*([^;}]+)/g)) {
    const value = m[3].replace(/!important/, '').trim();
    assert.ok(value === 'none' || value === 'normal' || value === 'brightness(0) invert(1)', `${m[2]}: ${value}`);
  }
});

test('unfound compendium pieces stay hidden (silhouette filter kept) and the enemy buff aura is exempt from the reset', () => {
  const kit = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(kit, /\.as-option\.is-ghost > \.as-artwell img \{[^}]*brightness\(0\) invert\(1\)/);
  assert.match(kit, /\.cp-detail:not\(\[data-state='held'\]\) > \.as-artwell img \{[^}]*brightness\(0\) invert\(1\)/);
  assert.match(css, /\.is-ghost > \.as-artwell img:not\(#lite-nofilter\):not\(#lite-nofilter-2\),\s*:root[^{]*\.cp-detail:not\(\[data-state='held'\]\) > \.as-artwell img:not\(#lite-nofilter\):not\(#lite-nofilter-2\) \{\s*filter: brightness\(0\) invert\(1\) !important;/);
  assert.ok(css.includes(":not(.sprite .facing[style*='drop-shadow'])"));
});

test('phone Lite adds no hit cue of its own and does not dim the illustrated card face a second time', () => {
  assert.ok(!/hitflash/.test(rawCss), 'Lite already shakes without a tint (Effects off); phones keep that');
  assert.ok(!/illustrated-card-face\s*\{\s*opacity/.test(css));
  assert.ok(!/stroke-width/.test(css), 'the selected map node keeps its base stroke width');
});

test('Lite keeps the painted combat backdrop blurs (static art, blurred once)', () => {
  const rule1 = css.match(/([^{}]+)\{\s*filter: none !important;\s*\}/)[1];
  for (const cls of ['.alternative-scene-fill', '.alternative-scene-edge'])
    assert.ok(rule1.includes(`:not(${cls})`), `${cls} must be exempt from Lite rule 1`);
});
