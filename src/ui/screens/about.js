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
import { CHANGELOG, PROJECT_REPOSITORY_URL } from '../../content/changelog.js';
import { ABOUT_BUILD_LINE, BUILD_VERSION, RUN_PATH } from '../../buildversion.js';

function changelogHtml(entries) {
  return entries.map((release) => `
    <section class="about-release" aria-labelledby="about-release-${esc(release.version)}">
      <h4 id="about-release-${esc(release.version)}">${esc(release.version)} · ${esc(release.label)}</h4>
      <p class="set-note about-release-date">${esc(release.date)}</p>
      <ul class="about-change-list">
        ${release.changes.map((change) => `
          <li>
            <details class="about-change">
              <summary>${esc(change.summary)}</summary>
              <p>${esc(change.detail)}</p>
            </details>
          </li>`).join('')}
      </ul>
    </section>`).join('');
}

function buildLineHtml(buildLine, runPath, repositoryUrl) {
  // A source-tree or raw-file run is a development/debug artifact. The shipped
  // standalone file stays plain text: it must not turn an offline version label
  // into an external navigation control. RUN_PATH is injected by the existing
  // build/serve door, so this renderer does not invent a second build-mode flag.
  if (runPath === 'standalone file') return esc(buildLine);
  const label = `Open the AshenSpire source repository for debug build ${BUILD_VERSION}`;
  return `<a class="about-version-link" href="${esc(repositoryUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}">${esc(buildLine)}</a>`;
}

export function renderAboutSection(container, {
  disclosure = AI_DISCLOSURE,
  changelog = CHANGELOG,
  repositoryUrl = PROJECT_REPOSITORY_URL,
  runPath = RUN_PATH,
  buildLine = ABOUT_BUILD_LINE,
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
  container.innerHTML = `
    <div class="about-ai">
      ${lead}
      ${sections}
      <section class="about-changelog" aria-labelledby="about-changelog-heading">
        <h3 id="about-changelog-heading">Changelog</h3>
        <p class="set-note">Open a change for the full notes.</p>
        ${changelogHtml(changelog)}
      </section>
      <div class="about-actions">
        <button class="about-copy">Save this to a file</button>
      </div>
      <p class="about-result" role="status"></p>
      <p class="set-note about-ver">${buildLineHtml(buildLine, runPath, repositoryUrl)}<br>${esc(runPath)} · acknowledgement last updated ${esc(disclosure.updated)}</p>
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
