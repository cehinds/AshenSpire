// tools/modal-shell-contract.mjs — the shell is the only chrome, and the count
// of surfaces that disagree only ever goes DOWN.
//
// WHAT THIS TOOL PROVES, AND WHAT IT DOES NOT.
//   PROVES   that modalShell.js exports one opener; that the button ladder
//            rejects a width it does not have; that a surface which adopts the
//            shell does not ALSO hand-roll a veil, a panel or a dismissal; and
//            that the number of surfaces still carrying their own chrome is at
//            or below the ratchet below.
//   DOES NOT prove behaviour. Escape closing the topmost dialog, focus return,
//            veil-click, the ladder's rendered widths and the uniform body
//            height are DOM facts, and this tool never opens a DOM. Both fake
//            DOMs in this repo (tests/confirmation-modal.test.mjs,
//            tools/flask-menu-cancel.mjs) lack querySelector/querySelectorAll/
//            classList, which openModal uses, so neither can drive it and a
//            third copy is not the answer. That gap is named here rather than
//            papered over with a source check dressed up as a behaviour check;
//            closing it wants a real page (tools/browser.mjs) and is owed.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass += 1; console.log(`PASS ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const css = read('styles/ui.css');
// COMMENTS OUT FIRST. The ladder's own block explains why `vh` is banned by
// quoting the measurement that banned it ("74vh x zoom"), so a check that
// greps the raw text fails on the sentence that documents the rule. Stripping
// comments is the difference between "does this stylesheet USE vh" and "does
// this stylesheet MENTION vh" — the first is the contract, the second was a
// false positive this tool went red on before it stripped them.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const chromeBlock = (selector) => {
  const flat = stripComments(css);
  const at = flat.indexOf(`${selector} {`);
  return at < 0 ? '' : flat.slice(at, flat.indexOf('}', at));
};

// ---- 1. one opener, and the ladder is closed ------------------------------
const shell = await import('../src/ui/components/modalShell.js');
check('the shell exports one door-opener', typeof shell.openModal === 'function');
check('the shell exports its head as a piece too', typeof shell.modalHead === 'function');
check('the ladder has exactly four steps',
  shell.BUTTON_ROW_SIZES.length === 4 && shell.BUTTON_ROW_SIZES.join(',') === 'short,medium,long,fill',
  shell.BUTTON_ROW_SIZES.join(','));
// buttonRow validates BEFORE it touches a document, so this runs without one.
let ladderRejected = false;
try { shell.buttonRow({ size: 'enormous' }); } catch { ladderRejected = true; }
check('a width the ladder does not have is rejected', ladderRejected);

// ---- 1b. the width ladder ------------------------------------------------
check('the shell names four widths', shell.MODAL_SIZES.join(',') === 'sm,md,lg,xl',
  shell.MODAL_SIZES.join(','));
for (const rung of shell.MODAL_SIZES) {
  check(`the ${rung} rung has a width`, /width:/.test(chromeBlock(`.modal[data-size='${rung}']`)));
}
// A door that still types its own width is a door outside the ladder, which is
// how "how wide is a modal" got as many answers as there were modals.
for (const door of ['.flask-inspect-modal', '.pile-modal']) {
  check(`${door} takes its width from a rung, not a literal`,
    !/width:\s*\d/.test(chromeBlock(door)), chromeBlock(door).slice(0, 60));
}

// ---- 2. a surface that adopts the shell owns no chrome of its own ---------
const ADOPTERS = ['src/ui/components/piles.js', 'src/ui/components/flask.js'];
for (const rel of ADOPTERS) {
  const source = read(rel);
  check(`${rel} opens through the shell`, source.includes("from './modalShell.js'"));
  check(`${rel} builds no veil of its own`, !/className\s*=\s*['"`]modal-veil/.test(source),
    'a hand-built .modal-veil is a second chrome');
  check(`${rel} binds no dismissal of its own`, !source.includes('bindModalDismiss('),
    'openModal already binds Escape, veil-click and focus return');
}

// The regression that motivated piles.js: it had NO way out but the veil.
const piles = read('src/ui/components/piles.js');
check('the pile viewer no longer listens for a bare veil click as its only exit',
  !piles.includes("addEventListener('click'") || piles.includes('shell.close'));

// ---- 3. the ratchet ------------------------------------------------------
// Surfaces that still assemble their own veil AND their own dismissal. Each
// one is a chance to get Escape, veil-click or focus return subtly wrong. The
// number may fall; a change that raises it fails here by name.
const RATCHET = 6;
const uiDirs = ['src/ui/components', 'src/ui/screens', 'src/ui'];
const holdouts = [];
for (const dir of uiDirs) {
  for (const name of readdirSync(resolve(root, dir))) {
    if (!name.endsWith('.js')) continue;
    const rel = join(dir, name);
    if (rel.endsWith('modalShell.js')) continue;
    const source = read(rel);
    const buildsVeil = /className\s*=\s*['"`][^'"`]*modal-veil/.test(source);
    if (buildsVeil && !source.includes("from './modalShell.js'") && !source.includes("from '../components/modalShell.js'")) {
      holdouts.push(rel);
    }
  }
}
check(`no more than ${RATCHET} surfaces still carry their own chrome`,
  holdouts.length <= RATCHET, `${holdouts.length}: ${holdouts.join(', ')}`);
console.log(`      holdouts (${holdouts.length}/${RATCHET}): ${holdouts.join(', ') || 'none'}`);

// ---- 4. the ladder types no length that --ui-zoom ignores ----------------
const ladderBlock = stripComments(css.slice(css.indexOf('.modal-btnrow'), css.indexOf('.modal-body')));
check('the ladder uses no viewport units',
  !/\d(?:vh|vw)\b/.test(ladderBlock),
  'the app is zoomed by --ui-zoom and viewport units ignore that zoom');
check('a square button takes its height from the row, by ratio',
  ladderBlock.includes('aspect-ratio: 1'));
// THE ROW IS A GRID OF EQUAL TRACKS. Under flex the buttons were uniform only
// while nothing squeezed them: three medium buttons beside a foot note shrank
// to 83px each and rendered as "B…", "S…", "S…" (measured 2026-09-03). Equal
// tracks make every button in a row the same width whatever its label; the
// row's width is the smaller of its box and n × step, so a step can never
// overflow the panel (the clipped-third-button bug) and, given room, every
// button IS the step.
check('a button row is a grid of equal tracks',
  /\.modal-btnrow\s*\{[^}]*grid-auto-columns:\s*minmax\(0,\s*1fr\)/.test(ladderBlock),
  'equal tracks are what makes primary and secondary the same size');
check('the row widens to n × step and no further',
  /width:\s*min\(100%,\s*calc\(var\(--n\)\s*\*\s*var\(--step\)/.test(ladderBlock),
  'a row that could exceed its box would clip its last button off the panel');
check('the row counts its own buttons', (ladderBlock.match(/\.modal-btnrow:has\(> :nth-child\(\d\):last-child\)\s*\{\s*--n:\s*\d;\s*\}/g) || []).length >= 4,
  'a caller that had to pass n would forget to');
const stepDecls = ladderBlock.match(/\.modal-btnrow\[data-size='(?:short|medium|long)'\]\s*\{[^}]*\}/g) || [];
check('the ladder has a step for short, medium and long', stepDecls.length === 3, `${stepDecls.length} found`);
check('each ladder step is a track CAP, never a min-width floor',
  stepDecls.every((decl) => /--step:\s*\d+rem/.test(decl) && !/min-width/.test(decl)),
  'a min-width step cannot shrink, so the row overflows the panel and clips its own buttons');
check('fill spans its box', /\.modal-btnrow\[data-size='fill'\]\s*\{\s*width:\s*100%/.test(ladderBlock));
// PADDING YIELDS BEFORE LETTERS DO. Base padding is 2.6rem a side; on a
// squeezed track that left 31px for "Save and Quit".
check('a row button\'s padding is a share of its track, capped',
  /\.modal-btnrow\s*>\s*button\s*\{[^}]*padding-inline:\s*clamp\(/.test(ladderBlock),
  'fixed 2.6rem padding is what ate the label');
check('no step is a flex basis any more', !/flex:\s*0\s+1\s+\d+rem/.test(ladderBlock),
  'a basis with min-width: 0 shrinks past the label; a track shares the box');

// ---- 4b. the head's actions are a property of the door, not a caller's memo
const shellSource = read('src/ui/components/modalShell.js');
check('the close control is unconditional',
  /const close = modalCloseButton\(/.test(shellSource) && !/if \([^)]*\)\s*\{?\s*const close = modalCloseButton/.test(shellSource),
  'one way out, same corner, every door');
check('the menu button follows the tab strip rather than defaulting either way',
  shellSource.includes('showMenuButton == null ? tabList.length > 0'),
  'a door with tabs is a place and wants the quick menu; a door that asks a question does not');
check('both header actions wear the square box',
  (shellSource.match(/dataset\.size = 'square'/g) || []).length >= 2);
// ONE BOX, EVERY COMPONENT. Close and ☰ used to take their size from a floor
// plus whatever their row stretched them to, so a tall row made a bigger
// close. Both read one fixed length on both axes now, and the row-height
// square rule no longer names them.
for (const sel of ['.modal-close', '.modal-iconbtn']) {
  const block = chromeBlock(sel);
  check(`${sel} is a fixed box on both axes`,
    /width:\s*var\(--iconbtn-size\)/.test(block) && /height:\s*var\(--iconbtn-size\)/.test(block) && /flex:\s*0 0 auto/.test(block),
    'close and ☰ are the same dimensions on every component, so their size is a length, not a floor');
}
check('the row-height square rule does not reach close or ☰',
  !/\.modal-(?:close|iconbtn)\[data-size='square'\]/.test(css),
  'a width: auto there would let a stretched row resize the one control that must never change shape');
check('the icon-button box has one home', /--iconbtn-size:\s*var\(--tap-floor\)/.test(read('styles/base.css')) && /--ui-tray-control-size:\s*var\(--iconbtn-size\)/.test(css));
// THE FOOT IS ON THE LADDER. It carried a data-size the ladder never read
// (the steps are written for .modal-btnrow), so primary and secondary hugged
// their own labels. Now the actions row wears both classes and stretches.
check('the footer actions row is a button row',
  /actions\.className = 'modal-foot-actions modal-btnrow'/.test(shellSource) && /actions\.dataset\.size = size/.test(shellSource),
  'a foot that is not a .modal-btnrow gets no step, so its buttons hug their labels');
check('openModal hands its footSize to the footer', /modalFooter\(\{[^}]*size: footSize/.test(shellSource));
check('footer buttons share one height', /\.modal-btnrow\s*\{[^}]*align-items:\s*stretch/.test(css) && !/\.modal-foot-actions\s*\{[^}]*align-items:\s*center/.test(css),
  'the foot is a button row; a centred row lets a two-line secondary sit taller than its primary');
check('the foot note is whole or absent, never a stub',
  /\.modal-foot-note\s*\{[^}]*container-type:\s*inline-size/.test(css) && /@container\s*\(max-width:[^)]*\)\s*\{\s*\.modal-foot-note\s*>\s*span\s*\{\s*visibility:\s*hidden/.test(css)
    && /const text = document\.createElement\('span'\);\s*text\.textContent = note;/.test(shellSource),
  'a note squeezed to one letter and an ellipsis is not a note');
check('type shrinks before a label truncates', /\.modal-btnrow\s*>\s*button\s*\{[^}]*container-type:\s*inline-size/.test(css) && /font-size:\s*clamp\([^)]*cqi/.test(css),
  'the ladder is padding -> box -> type -> truncate; without a type rung a long label goes straight to …');
check('the in-run menu\'s ☰ and foot wear the shared box and ladder',
  /class="subtle modal-iconbtn" id="ov-quicknav"/.test(read('src/ui/components/menuComponents.js')) && /modal-foot-actions overlay-footer-actions modal-btnrow" data-size=/.test(read('src/ui/components/menuComponents.js')),
  'the quick menu was the screenshot the directive came from');
check('the title door\'s close wears the shared box',
  /class="subtle modal-close title-modal-close"/.test(read('src/ui/screens/title.js')));

// The close control's top inset must be the head's padding, not half of
// whatever the identity's height happens to be. `.modal-head` centres its
// children, so the actions ROW needs `align-self: flex-start` — `align-items`
// inside it cannot reach past its own box.
const headActions = chromeBlock('.modal-head-actions');
check('the header actions sit at the top, not centred against the title',
  /align-self:\s*flex-start/.test(headActions),
  'without align-self the close control drifts down beside a two-line identity');

// ---- 4c. a label can never leave its control -----------------------------
// The four declarations are ONE recipe; a control missing any of them can
// bleed. Checked as a set on the shell's own text-bearing controls, because
// the defect was found five times on five controls and fixed once.
const contained = chromeBlock('.modal-btnrow > button, .modal-tab, .modal-head-status, .modal-foot-note, .modal-head-id h2');
for (const decl of ['min-width: 0', 'overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) {
  check(`shell labels declare ${decl}`, contained.includes(decl),
    'a single-line label needs all four to be unable to bleed');
}

// ---- 5. head and foot are inset by ONE number, all four sides ------------
const chrome = stripComments(css);
// ONE INSET, ONE TOKEN, EVERY PART OF EVERY MODAL. Four different insets were
// in play (head 1.2/1.6, flask body 1.8/1.6, pile body 1.6, .modal 2.2) on
// surfaces meant to read as one system. Two things are checked: the value is
// single-component (so top matches left matches bottom matches right), and it
// comes from the token rather than a number typed per bar — a typed number is
// how they drifted in the first place.
check('the shell declares one inset token', /\.modal\s*\{\s*--modal-inset:/.test(chrome));
for (const part of ['.modal-head', '.modal-foot', '.flask-inspect-body', '.pile-body']) {
  const block = chromeBlock(part);
  const padding = (block.match(/padding:\s*([^;]+);/) || [])[1] || '';
  check(`${part} is inset by one value on all four sides`,
    padding.trim().split(/\s+/).length === 1, `padding: ${padding.trim() || '(none)'}`);
  check(`${part} reads the inset token rather than typing a number`,
    padding.includes('--modal-inset'), `padding: ${padding.trim() || '(none)'}`);
}

console.log(`\nmodal-shell-contract: ${pass} passed, ${fail} failed`);
console.log('BOUNDARY: source and pure-function checks only. Escape/topmost, focus return,');
console.log('      veil-click, rendered ladder widths and uniform body height are NOT');
console.log('      covered here — they need a real page and are owed.');
process.exit(fail ? 1 : 0);
