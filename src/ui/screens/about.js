// src/ui/screens/about.js — Settings → About: the in-product AI acknowledgement.
//
// Every word here comes from src/content/aiDisclosure.js. This file renders and
// does not author: if you want to change what the game says about how it was
// made, change that module and both this screen and the store text change with
// it. A sentence typed into this file would be the second copy the arrangement
// exists to prevent.
//
// Follows the Profile section's pattern (profileArchive.js): a section rendered
// into the Settings modal rather than a screen of its own.

import { esc } from '../components/tooltip.js';
import { AI_DISCLOSURE, disclosureAsText } from '../../content/aiDisclosure.js';
import { ABOUT_BUILD_LINE, BUILD_VERSION, RUN_PATH } from '../../buildversion.js';
import { CHANGELOG, PROJECT_REPOSITORY_URL } from '../../content/changelog.js';

/**
 * A source-server build is development by construction. A standalone bundle
 * is ambiguous until its host is known: the canonical GitHub Pages host is the
 * current-dev preview, while a file:// bundle is a release-shaped artifact and
 * must not silently gain a repository action.
 */
export function shouldLinkDebugVersion({ runPath = RUN_PATH, locationLike = globalThis.location } = {}) {
  if (runPath === 'source tree') return true;
  return runPath === 'standalone file'
    && locationLike?.protocol === 'https:'
    && locationLike?.hostname === 'cehinds.github.io';
}
function changelogHtml(entries) {
  let group = null;
  return entries.map((entry) => {
    const heading = entry.group === group ? '' : `<h3>${esc(entry.group)}</h3>`;
    group = entry.group;
    return `${heading}
      <details class="about-change" data-change-id="${esc(entry.id)}">
        <summary class="region-fold">
          <span class="rf-label">${esc(entry.summary)}</span>
          <span class="region-count">${esc(entry.build)}</span>
        </summary>
        <p class="set-note">${esc(entry.detail)}</p>
        <p class="set-note"><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">Pull request #${entry.pullRequest}</a></p>
      </details>`;
  }).join('');
}

export function renderAboutSection(container, {
  disclosure = AI_DISCLOSURE,
  changelog = CHANGELOG,
  runPath = RUN_PATH,
  locationLike = globalThis.location,
} = {}) {
  const sections = disclosure.sections
    .map(
      (s) => `
        <div class="about-block">
          <b>${esc(s.heading)}</b>
          <p class="set-note">${esc(s.body)}</p>
        </div>`
    )
    .join('');

  // Sunna's non-blocking push: the lead ran 14 unbroken lines. It is PARAGRAPHED
  // here, never rewritten — the string stays byte-identical to the one the store
  // form uses (that is what `--check` matches), and only the presentation
  // changes. Sentences are grouped 2/2/1 so the claim that matters most — no AI
  // while you play — lands in its own paragraph.
  const sentences = disclosure.storeForm.split(/(?<=\.)\s+/);
  const groups = sentences.length >= 4
    ? [sentences.slice(0, 2), sentences.slice(2, 4), sentences.slice(4)]
    : [sentences];
  const lead = groups
    .filter((g) => g.length)
    .map((g) => `<p class="about-lead">${esc(g.join(' '))}</p>`)
    .join('');

  // THE VERSION LINE — A4, Constantine's pick of four ("a4 is really nice",
  // 2026-08-16), and every field on it is DERIVED. It used to read
  // `Ashen Spire 0.4.x`, a scope string typed by hand into the disclosure
  // module — a second version site the build check had been holding OPEN
  // pending exactly this decision (tools/buildversion.mjs, OPEN_SECOND_SITES).
  //
  // Row 1 comes composed from src/buildversion.js so the drop rules live with
  // the facts; row 2 is joined here because the acknowledgement date is the one
  // thing on the line that module has no business owning. The `<br>` is
  // deliberate and not a wrap: the break is between WHAT THIS BUILD IS and HOW
  // IT REACHED YOU, and a break that falls wherever the box ends puts `src`
  // above `6654d22741` on some phone we did not measure.
  //
  // WHAT IT COSTS, stated because he was told it before he chose: the line now
  // MOVES EVERY BUILD. That is the point — a screenshot pins the tree — and it
  // is also the reason the About footer is no longer a stable string anyone can
  // eyeball for "did anything change".
  const buildLine = shouldLinkDebugVersion({ runPath, locationLike })
    ? `<a class="about-debug-version" href="${PROJECT_REPOSITORY_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open the AshenSpire source repository for development build ${esc(BUILD_VERSION)}">${esc(ABOUT_BUILD_LINE)}</a>`
    : esc(ABOUT_BUILD_LINE);

  container.innerHTML = `
    <div class="about-ai">
      ${lead}
      ${sections}
      <section class="about-changelog" aria-labelledby="about-changelog-title">
        <h2 id="about-changelog-title">Changelog</h2>
        ${changelogHtml(changelog)}
      </section>
      <div class="about-actions">
        <button class="about-copy">Save this to a file</button>
      </div>
      <p class="about-result" role="status"></p>
      <p class="set-note about-ver">${buildLine}<br>${esc(runPath)} · acknowledgement last updated ${esc(disclosure.updated)}</p>
    </div>`;

  // The player can keep a copy of what they were told. Same instinct as the
  // profile export: a claim you can save is a claim you can hold us to.
  container.querySelector('.about-copy').addEventListener('click', () => {
    const say = (m) => { container.querySelector('.about-result').textContent = m; };
    try {
      const blob = new Blob([disclosureAsText(disclosure, BUILD_VERSION)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ashen-spire-ai-acknowledgement.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Saved.');
    } catch (e) {
      say('Couldn’t save the file here — the text above is the whole of it.');
    }
  });
}
