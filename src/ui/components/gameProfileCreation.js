import { t } from '../strings.js';
import { classSprite, tintCss } from '../assets.js';
// Fixed-loadout selection reuses the normal start callback and run model guard.
export function mountGameProfileCreation(app, { profile, classes, available, starterCount = null, classUnlocks = false, defaultSeedString, onStart, onBack }) {
  app.replaceChildren();
  const screen = document.createElement('section');
  screen.className = 'screen game-profile-creation';
  screen.style.cssText = 'max-width:52rem;margin:auto;padding:2rem;display:flex;flex-direction:column;gap:1rem';
  const heading = document.createElement('h1'); heading.textContent = t('gameProfile.creation.copy1');
  const note = document.createElement('p'); note.textContent = `Fixed starting equipment${starterCount == null ? '' : ` · ${starterCount} starting cards`}.${classUnlocks ? ' Complete a run to unlock the next class.' : ''}`;
  const portrait = document.createElement('div'); portrait.className = 'figure cc-class-art'; portrait.style.cssText = 'height:18rem;max-width:20rem;margin:auto';
  const choices = document.createElement('div'); choices.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem';
  const summary = document.createElement('p'); summary.setAttribute('aria-live', 'polite');
  const seed = document.createElement('input'); seed.value = defaultSeedString;
  seed.setAttribute('aria-label', t('gameProfile.creation.copy4'));
  const start = document.createElement('button'); start.textContent = t('gameProfile.creation.copy2');
  const back = document.createElement('button'); back.textContent = t('gameProfile.creation.copy3'); back.onclick = onBack;
  const status = document.createElement('p'); status.setAttribute('role', 'alert');
  let selected = classes.find(row => available(row.id))?.id;
  const refresh = () => {
    for (const button of choices.children) button.setAttribute('aria-pressed', String(button.dataset.classId === selected));
    const row = classes.find(row => row.id === selected);
    portrait.replaceChildren();
    if (row) portrait.append(classSprite(row.id, tintCss('gold'), '⚔', 'gold', 'classic'));
    summary.textContent = row ? `${row.name} · ${Object.entries(row.attributes || {}).map(([key, value]) => `${key} ${value}`).join(' · ')} · ${Object.values(row.loadout || {}).filter(Boolean).join(' / ')}` : 'No eligible class is available.';
    start.disabled = !row;
  };
  for (const row of classes) {
    const button = document.createElement('button'); button.dataset.classId = row.id;
    button.disabled = !available(row.id); button.textContent = row.name + (button.disabled ? ' · Locked' : '');
    button.onclick = () => { selected = row.id; refresh(); }; choices.append(button);
  }
  start.onclick = async () => {
    start.disabled = true;
    try { await onStart({ classId: selected, seedString: seed.value.trim(), gameProfile: profile }); }
    catch (error) { status.textContent = error.message; }
    finally { if (app.contains(start)) refresh(); }
  };
  screen.append(heading, note, choices, portrait, summary, seed, start, back, status); app.append(screen); refresh();
}
