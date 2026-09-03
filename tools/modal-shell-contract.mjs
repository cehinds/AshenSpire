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
const ladderBlock = stripComments(css.slice(css.indexOf('.modal-btnrow'), css.indexOf('.modal-body')));
check('the ladder uses no viewport units',
  !/\d(?:vh|vw)\b/.test(ladderBlock),
  'the app is zoomed by --ui-zoom and viewport units ignore that zoom');
check('a square button takes its height from the row, by ratio',
  ladderBlock.includes('aspect-ratio: 1'));
// THE REGRESSION THIS PINS. The ladder's steps were `min-width`, which is a
// HARD minimum: two `medium` buttons wanted 30rem, a foot with a note had
// less, `nowrap` refused to wrap, and the row overflowed — clipped by
// `.modal`'s own `overflow: hidden`, so a third button was cut off the panel
// and could not be pressed at all. A basis shrinks; a floor overflows.
const stepDecls = ladderBlock.match(/\.modal-btnrow\[data-size='(?:short|medium|long)'\][^{]*\{[^}]*\}/g) || [];
check('the ladder has a step for short, medium and long', stepDecls.length === 3, `${stepDecls.length} found`);
check('each ladder step is a flex BASIS, never a min-width floor',
  stepDecls.every((decl) => /flex:\s*0\s+1\s/.test(decl) && !/min-width/.test(decl)),
  'a min-width step cannot shrink, so the row overflows the panel and clips its own buttons');
// A flex item's min-width is `auto` by default, which is what stops a shrink
// from eating the label. Setting it to 0 on a text button would clip text.
check('the ladder does not zero a text button\'s min-width',
  !/\.modal-btnrow\s*>\s*button\s*\{[^}]*min-width:\s*0/.test(ladderBlock),
  'min-width: 0 lets a nowrap label clip instead of stopping the shrink at its text');

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

// The close control's top inset must be the head's padding, not half of
// whatever the identity's height happens to be. `.modal-head` centres its
// children, so the actions ROW needs `align-self: flex-start` — `align-items`
// inside it cannot reach past its own box.
const headActions = chromeBlock('.modal-head-actions');
check('the header actions sit at the top, not centred against the title',
  /align-self:\s*flex-start/.test(headActions),
  'without align-self the close control drifts down beside a two-line identity');

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
