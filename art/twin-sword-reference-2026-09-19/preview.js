'use strict';
const library = window.TWIN_SWORD_ART;
let art = library.groups[0];
let loadVersion = 0;
const $ = id => document.getElementById(id);
const bodyPoses = art.poses.filter(id => id !== 'PORTRAIT');
let config = structuredClone(library.attack);
let frame = 0, playing = false, lastTime = 0, imagesReady = false;
const imageCache = new Map();
function option(value, label = value) { const el = document.createElement('option'); el.value = value; el.textContent = label; return el; }
for (const pose of art.poses) $('action').append(option(pose));
function currentSequence() { return $('action').value === 'attack' ? config.frames : [$('action').value]; }
function render() {
  const sequence = currentSequence();
  frame = Math.min(Math.max(frame, 0), sequence.length - 1);
  const pose = sequence[frame];
  $('sprite').src = imageCache.get(pose)?.src || art.frames[pose].file;
  $('sprite').alt = `${art.classId} twin swords: ${pose}, ${art.notes[pose]}`;
  $('poseName').textContent = pose;
  $('poseNote').textContent = art.notes[pose];
  $('position').textContent = `${frame + 1} / ${sequence.length}`;
  $('scrub').max = sequence.length - 1; $('scrub').value = frame;
  $('scrub').disabled = sequence.length === 1;
  $('stepCount').textContent = frame + 1;
  $('play').disabled = !imagesReady || sequence.length === 1;
  $('play').textContent = playing ? 'Pause' : 'Play';
  document.querySelectorAll('#sequence li').forEach((row, i) => row.classList.toggle('active', $('action').value === 'attack' && i === frame));
  const rate = Number($('speed').value);
  document.querySelectorAll('.outfit-card').forEach(card => {
    card.classList.toggle('active', card.dataset.group === art.id);
    const group = library.groups.find(g => g.id === card.dataset.group);
    card.querySelector('img').src = group.frames[$('compare').checked ? pose : 'STANCE-READY'].file;
  });
  $('timing').textContent = `${config.frames.length} steps · ${Math.round(config.frames.length * config.frameMs / rate)} ms total · impact at ${Math.round(config.impactIndex * config.frameMs / rate)} ms at ${rate}× speed.`;
}
function pause() { playing = false; lastTime = 0; render(); }
function changeAction(pose) { $('action').value = pose; frame = 0; pause(); }
function button(text, title, handler) { const el = document.createElement('button'); el.textContent = text; el.title = title; el.setAttribute('aria-label', title); el.onclick = handler; return el; }
function mutate(operation) { pause(); operation(); frame = 0; renderEditor(); render(); $('status').textContent = 'Preview changed. Save sequence JSON to keep this candidate.'; }
function renderEditor() {
  $('sequence').replaceChildren(); $('impact').replaceChildren();
  config.frames.forEach((pose, i) => {
    const row = document.createElement('li'); row.classList.toggle('impact', i === config.impactIndex);
    const select = document.createElement('select'); select.setAttribute('aria-label', `Pose for step ${i + 1}`);
    for (const id of bodyPoses) select.append(option(id)); select.value = pose;
    select.onchange = () => mutate(() => { config.frames[i] = select.value; });
    const up = button('↑', `Move step ${i + 1} earlier`, () => mutate(() => {
      [config.frames[i - 1], config.frames[i]] = [config.frames[i], config.frames[i - 1]];
      if (config.impactIndex === i) config.impactIndex--; else if (config.impactIndex === i - 1) config.impactIndex++;
    })); up.disabled = i === 0;
    const down = button('↓', `Move step ${i + 1} later`, () => mutate(() => {
      [config.frames[i + 1], config.frames[i]] = [config.frames[i], config.frames[i + 1]];
      if (config.impactIndex === i) config.impactIndex++; else if (config.impactIndex === i + 1) config.impactIndex--;
    })); down.disabled = i === config.frames.length - 1;
    const remove = button('×', `Remove step ${i + 1}`, () => mutate(() => {
      config.frames.splice(i, 1);
      if (i < config.impactIndex) config.impactIndex--;
      config.impactIndex = Math.min(config.impactIndex, config.frames.length - 1);
    })); remove.disabled = config.frames.length === 1;
    row.append(select, up, down, remove); $('sequence').append(row);
    $('impact').append(option(String(i), `${i + 1} · ${pose}`));
  });
  $('impact').value = config.impactIndex;
  $('frameMs').value = config.frameMs;
  $('add').disabled = config.frames.length >= 32;
}
function renderGallery() {
 $('gallery').replaceChildren();
 for (const pose of art.poses) {
  const card = document.createElement('button'); card.className = 'pose-card';
  const img = document.createElement('img'); img.src = art.frames[pose].file; img.alt = `Inspect ${pose}`; img.width = img.height = 512; img.loading = 'lazy';
  const name = document.createElement('span'); name.textContent = pose;
  const note = document.createElement('small'); note.textContent = art.notes[pose];
  card.append(img, name, note); card.onclick = () => { changeAction(pose); $('stage').scrollIntoView({block:'center'}); };
  $('gallery').append(card);
 }
}
$('play').onclick = () => { playing = !playing; lastTime = 0; render(); };
$('previous').onclick = () => { frame = (frame - 1 + currentSequence().length) % currentSequence().length; pause(); };
$('next').onclick = () => { frame = (frame + 1) % currentSequence().length; pause(); };
$('scrub').oninput = () => { frame = Number($('scrub').value); pause(); };
$('action').onchange = () => changeAction($('action').value);
$('speed').onchange = () => { lastTime = 0; render(); };
$('background').onchange = () => { $('stage').className = `stage ${$('background').value}`; };
$('showAnchor').onchange = () => { $('anchor').hidden = !$('showAnchor').checked; };
$('frameMs').onchange = () => { config.frameMs = Math.max(40, Math.min(1000, Math.round(Number($('frameMs').value) || 120))); $('frameMs').value = config.frameMs; pause(); $('status').textContent = 'Preview timing changed. Save sequence JSON to keep it.'; };
$('impact').onchange = () => mutate(() => { config.impactIndex = Number($('impact').value); });
$('add').onclick = () => mutate(() => { if (config.frames.length < 32) config.frames.push('STANCE-READY'); });
$('reset').onclick = () => mutate(() => { config = structuredClone(library.attack); });
$('download').onclick = () => {
  const blob = new Blob([JSON.stringify(config, null, 2) + '\n'], {type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'twin-sword-attack-sequence.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = 'Sequence JSON downloaded. Share it with the art review to keep this pose order.';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function tick(time) {
  if (playing && imagesReady && !document.hidden) {
    const interval = config.frameMs / Number($('speed').value);
    if (!lastTime) lastTime = time;
    if (time - lastTime >= interval) { frame = (frame + Math.floor((time - lastTime) / interval)) % currentSequence().length; lastTime = time - ((time - lastTime) % interval); render(); }
  }
  requestAnimationFrame(tick);
}
function appearanceKey(row) {
  const id = String(row.sharedSet).toLowerCase() === 'true' ? row.id : row.artKey || row.id;
  return row.classId + (id === 'default' ? '' : '-' + id);
}
function renderOutfits() {
  const classId = $('classFilter').value;
  const rows = library.outfits.filter(row => classId === 'all' || row.classId === classId);
  $('outfit').replaceChildren(); $('outfitGallery').replaceChildren();
  for (const row of rows) {
    const group = library.groups.find(g => g.id === appearanceKey(row));
    if (!group) continue;
    const rowId = row.classId + '/' + row.id;
    $('outfit').append(option(rowId, row.classId + ' · ' + row.name + (row.id === 'default' ? ' (default)' : '')));
    const card = document.createElement('button'); card.className = 'outfit-card'; card.dataset.group = group.id;
    const img = document.createElement('img'); img.src = group.frames['STANCE-READY'].file; img.alt = row.classId + ' ' + row.name; img.width = img.height = 512; img.loading = 'lazy';
    const name = document.createElement('span'); name.textContent = row.name;
    const detail = document.createElement('small'); detail.textContent = row.classId + (row.id === 'default' ? ' · default' : String(row.sharedSet).toLowerCase() !== 'true' && row.id !== (row.artKey || row.id) ? ' · alias' : '');
    card.append(img, name, detail); card.onclick = () => { $('outfit').value = rowId; loadOutfit(); };
    $('outfitGallery').append(card);
  }
  $('coverage').textContent = `${library.coverage.generatedAppearances}/${library.coverage.expectedAppearances} appearances · ${library.coverage.catalogEntries} armor entries`;
}
function loadOutfit() {
  const [classId, armourId] = $('outfit').value.split('/');
  const row = library.outfits.find(r => r.classId === classId && r.id === armourId);
  art = library.groups.find(g => g.id === appearanceKey(row));
  $('selectedName').textContent = classId + ' · ' + row.name + (armourId === 'default' ? ' (default)' : '');
  $('sheetLink').href = `frames/${art.id}/labeled-sheet.webp`;
  imagesReady = false; imageCache.clear(); pause(); renderGallery();
  const version = ++loadVersion;
  Promise.all(art.poses.map(pose => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => { if (version === loadVersion) imageCache.set(pose, img); resolve(); }; img.onerror = () => reject(new Error(`Missing ${pose}`)); img.src = art.frames[pose].file;
  }))).then(() => { if (version === loadVersion) { imagesReady = true; render(); } }).catch(error => { if (version === loadVersion) $('status').textContent = `Preview could not load: ${error.message}`; });
}
$('classFilter').onchange = () => { renderOutfits(); loadOutfit(); };
$('outfit').onchange = loadOutfit;
$('compare').onchange = render;
renderEditor(); renderOutfits(); loadOutfit(); requestAnimationFrame(tick);
