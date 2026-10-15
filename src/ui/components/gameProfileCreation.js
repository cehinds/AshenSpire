// Fixed-loadout selection reuses the normal start callback and run model guard.
export function mountGameProfileCreation(app, { profile, classes, available, defaultSeedString, onStart, onBack }) {
  app.replaceChildren();
  const screen = document.createElement('section');
  screen.className = 'screen game-profile-creation';
  screen.style.cssText = 'max-width:52rem;margin:auto;padding:2rem;display:flex;flex-direction:column;gap:1rem';
  const heading = document.createElement('h1'); heading.textContent = 'Choose your class';
  const note = document.createElement('p'); note.textContent = 'Fixed starting equipment and ten cards. Complete a run to unlock the next class.';
  const choices = document.createElement('div'); choices.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem';
  const summary = document.createElement('p'); summary.setAttribute('aria-live', 'polite');
  const seed = document.createElement('input'); seed.value = defaultSeedString;
  seed.setAttribute('aria-label', 'Run seed');
  const start = document.createElement('button'); start.textContent = 'Begin the climb';
  const back = document.createElement('button'); back.textContent = 'Back'; back.onclick = onBack;
  const status = document.createElement('p'); status.setAttribute('role', 'alert');
  let selected = classes.find(row => available(row.id))?.id;
  const refresh = () => {
    for (const button of choices.children) button.setAttribute('aria-pressed', String(button.dataset.classId === selected));
    const row = classes.find(row => row.id === selected);
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
  screen.append(heading, note, choices, summary, seed, start, back, status); app.append(screen); refresh();
}
