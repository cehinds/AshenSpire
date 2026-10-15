// New-run configuration only: selecting/importing never mutates a running save.
export function mountGameProfileSelector(host, { profile, importedProfile = null, onSelect }) {
  const panel = document.createElement('div');
  panel.className = 'game-profile-selector';
  panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:center;margin:.75rem auto;max-width:38rem';
  const label = document.createElement('label');
  label.textContent = 'New game: ';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'New game configuration');
  for (const [id, name] of [['current', 'Current game'], ['core', 'Ashen core']]) {
    const option = new Option(name, id);
    select.append(option);
  }
  if (importedProfile) select.append(new Option('Imported configuration', 'imported'));
  select.value = importedProfile?.hash === profile.hash ? 'imported' : profile.id;
  label.append(select);
  const upload = document.createElement('input');
  upload.type = 'file'; upload.accept = '.json,application/json';
  upload.setAttribute('aria-label', 'Import game configuration JSON');
  upload.style.maxWidth = '16rem';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.style.cssText = 'width:100%;font-size:.8rem;overflow-wrap:anywhere;text-align:center';
  status.textContent = `${importedProfile?.hash === profile.hash ? 'Imported configuration' : profile.id === 'core' ? 'Ashen core' : 'Current game'} · applies to this new run`;
  const apply = async value => {
    try { await onSelect(value); }
    catch (error) { status.textContent = error.message; select.value = importedProfile?.hash === profile.hash ? 'imported' : profile.id; }
  };
  select.addEventListener('change', () => apply(select.value));
  upload.addEventListener('change', async () => {
    try {
      const file = upload.files?.[0];
      if (file) await apply(JSON.parse(await file.text()));
    } catch (error) { status.textContent = `Configuration not applied: ${error.message}`; }
  });
  panel.append(label, upload, status); host.append(panel);
  return panel;
}
