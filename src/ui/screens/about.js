// src/ui/screens/about.js — Settings → About: the in-product AI acknowledgement.
//
// Every word here comes from src/content/aiDisclosure.js. This file renders and
// does not author: if you want to change what the game says about how it was
// made, change that module and both this screen and the store text change with
// it. A sentence typed into this file would be the second copy the arrangement
// exists to prevent.
//
// About stays inside Settings; the Profile archive is now a title-screen route.
//
// ON THE KIT: the acknowledgement is Prose under the settings pane's heading —
// the lead as paragraphs, each section as Eyebrow + Title·S + Prose, a
// ButtonRow for the one action, StatusText for its result, and Flavour for the
// version line. The changelog is a column of kit Folds: the summary is a Row
// (label = the change, StatusText = the build), the body is Prose. The hooks
// tools/about-changelog.mjs reads (`.about-ai`, `.about-block`, `.about-copy`,
// `.about-debug-version`, `.about-changelog`, `details.about-change`,
// `.about-change-pr`) ride on the kit's parts and draw nothing.

import { esc } from '../components/tooltip.js';
import { AI_DISCLOSURE, disclosureAsText } from '../../content/aiDisclosure.js';
import { ABOUT_BUILD_LINE, BUILD_VERSION, RUN_PATH } from '../../buildversion.js';
import { CHANGELOG, PROJECT_REPOSITORY_URL } from '../../content/changelog.js';
import { el, prose, eyebrow, titleS, button, buttonRow, statusText, flavour, fold, hairline } from '../kit/index.js';

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
export function shouldLinkChangelog(options = {}) {
  return shouldLinkDebugVersion(options);
}
function changelogNodes(entries, { linkExternal = false } = {}) {
  let group = null;
  const nodes = [];
  for (const entry of entries) {
    if (entry.group !== group) {
      nodes.push(el('div', { class: 'set-section-head about-group' }, [eyebrow('Changes'), titleS(entry.group, { tag: 'h3' })]));
      group = entry.group;
    }
    const pr = linkExternal
      ? el('a', { class: 'about-change-pr', href: entry.url, target: '_blank', rel: 'noopener noreferrer', text: `Pull request #${entry.pullRequest}` })
      : el('span', { class: 'about-change-pr', 'aria-label': `Pull request #${entry.pullRequest}; external navigation unavailable in this artifact`, text: `Pull request #${entry.pullRequest}` });
    nodes.push(fold({
      label: entry.summary,
      status: entry.build,
      className: 'about-change',
      attrs: { dataset: { changeId: entry.id } },
      children: [prose(entry.detail), el('p', { class: 'as-prose' }, pr)],
    }));
  }
  return nodes;
}

export function renderChangelogSection(container, {
  changelog = CHANGELOG,
  runPath = RUN_PATH,
  locationLike = globalThis.location,
} = {}) {
  const changeLinks = shouldLinkChangelog({ runPath, locationLike });
  container.innerHTML = '';
  container.appendChild(el('section', { class: 'about-changelog', 'aria-labelledby': 'advanced-changelog-title' }, [
    el('div', { class: 'set-section-head' }, [eyebrow('Advanced'), titleS('What changed', { tag: 'h2', id: 'advanced-changelog-title' })]),
    flavour('Newest changes are first. Open an entry for the player-facing detail.'),
    hairline(),
    ...changelogNodes(changelog, { linkExternal: changeLinks }),
  ]));
}

export function renderAboutSection(container, {
  disclosure = AI_DISCLOSURE,
  runPath = RUN_PATH,
  locationLike = globalThis.location,
} = {}) {
  const sections = disclosure.sections.map((s) => el('div', { class: 'about-block' }, [
    el('div', { class: 'set-section-head' }, [eyebrow('About'), titleS(s.heading, { tag: 'h3' })]),
    prose(s.body),
  ]));

  // Sunna's non-blocking push: the lead ran 14 unbroken lines. It is PARAGRAPHED
  // here, never rewritten — the string stays byte-identical to the one the store
  // form uses (that is what `--check` matches), and only the presentation
  // changes. Sentences are grouped 2/2/1 so the claim that matters most — no AI
  // while you play — lands in its own paragraph.
  const sentences = disclosure.storeForm.split(/(?<=\.)\s+/);
  const groups = sentences.length >= 4
    ? [sentences.slice(0, 2), sentences.slice(2, 4), sentences.slice(4)]
    : [sentences];
  const lead = groups.filter((g) => g.length).map((g) => prose(g.join(' '), { class: 'about-lead' }));

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
  const copy = button({ label: 'Save this to a file', className: 'about-copy' });
  const result = statusText('', { class: 'about-result', role: 'status' });
  container.innerHTML = '';
  container.appendChild(el('div', { class: 'about-ai' }, [
    ...lead,
    ...sections,
    buttonRow({ size: 'long', buttons: [copy], className: 'about-actions' }),
    result,
    el('span', { class: 'as-flavor about-ver', html: `${buildLine}<br>${esc(runPath)} · acknowledgement last updated ${esc(disclosure.updated)}` }),
  ]));

  // The player can keep a copy of what they were told. Same instinct as the
  // profile export: a claim you can save is a claim you can hold us to.
  copy.addEventListener('click', () => {
    const say = (m) => { result.textContent = m; };
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
