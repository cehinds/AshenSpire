'use strict';
const collection = window.UNARMED_ART;
let art = collection.groups.find(group => group.id === 'reaver');
const el = id => document.getElementById(id);
const gallery = [];
el('coverage').textContent = `${collection.coverage.exportedAppearances} / ${collection.coverage.expectedAppearances} appearances · ${collection.coverage.catalogEntries} armor entries · One shared pose sequence`;
for (const group of collection.groups) {
  const option = document.createElement('option'); option.value = group.id; option.textContent = group.id; el('skin').append(option);
  const button = document.createElement('button'); button.className = 'pose'; button.dataset.classId = group.classId;
  const image = document.createElement('img'); image.alt = group.id; image.loading = 'lazy';
  const label = document.createElement('span'); label.textContent = group.id;
  button.append(image,label); el('gallery').append(button); gallery.push({group,image,button});
  button.onclick = () => { el('skin').value = group.id; chooseSkin(); el('stage').scrollIntoView({behavior:'smooth',block:'center'}); };
}
function chooseSkin() {
  art = collection.groups.find(group => group.id === el('skin').value);
  for (const image of el('poses').querySelectorAll('img')) image.src = art.frames[image.alt].file;
  const links = el('poses').parentElement.querySelectorAll('a');
  links[0].href = `frames/${art.id}/labeled-sheet.webp`; links[1].href = art.source;
  render();
}
el('skin').onchange = chooseSkin;
el('classFilter').onchange = () => { for (const row of gallery) row.button.hidden = el('classFilter').value !== 'all' && el('classFilter').value !== row.group.classId; render(); };
let order = [...art.sequence], sequence = [...order], index = 0, timer = null;
for (const id of art.poses) {
  const option = document.createElement('option'); option.value = id; option.textContent = id; el('action').append(option);
  const preload = new Image(); preload.src = art.frames[id].file;
  const button = document.createElement('button'); button.className = 'pose';
  const image = document.createElement('img'); image.src = art.frames[id].file; image.alt = id; image.loading = 'lazy';
  const label = document.createElement('span'); label.textContent = id; button.append(image, label);
  button.addEventListener('click', () => { el('action').value = id; setAction(); el('stage').scrollIntoView({behavior:'smooth',block:'center'}); });
  el('poses').append(button);
}
function render() {
  const pose = sequence[index]; el('actor').src = art.frames[pose].file; el('actor').alt = `${art.id} unarmed ${pose}`;
  el('caption').textContent = `${art.id} · Step ${index+1} / ${sequence.length} · ${pose}`;
  for (const row of gallery) if (!row.button.hidden) row.image.src = row.group.frames[pose].file;
  el('scrub').max = String(sequence.length-1); el('scrub').value = String(index);
}
function stop() { clearInterval(timer); timer = null; el('play').textContent = 'Play'; }
function start() { stop(); if (sequence.length < 2) return; timer = setInterval(() => { index = (index+1)%sequence.length; render(); }, Number(el('speed').value)); el('play').textContent = 'Pause'; }
function setAction() { stop(); sequence = el('action').value === 'attack' ? [...order] : [el('action').value]; index = 0; render(); }
el('play').onclick = () => timer ? stop() : start();
el('previous').onclick = () => { stop(); index = (index+sequence.length-1)%sequence.length; render(); };
el('next').onclick = () => { stop(); index = (index+1)%sequence.length; render(); };
el('scrub').oninput = () => { stop(); index = Number(el('scrub').value); render(); };
el('action').onchange = setAction;
el('speed').oninput = () => { el('speedValue').textContent = el('speed').value; if (timer) start(); };
el('background').onchange = () => { el('stage').className = 'stage '+el('background').value; };
el('showAnchor').onchange = () => { el('anchor').hidden = !el('showAnchor').checked; };
el('order').value = order.join(', ');
el('apply').onclick = () => {
  const next = el('order').value.split(/[,\s]+/).filter(Boolean);
  const invalid = next.filter(p => !art.poses.includes(p) || ['PORTRAIT','CONVERSATION'].includes(p));
  if (!next.length || next.length > 64 || invalid.length) { el('message').textContent = invalid.length ? `Unknown or non-combat pose: ${invalid.join(', ')}` : 'Enter between 1 and 64 combat poses.'; return; }
  order = next; el('action').value = 'attack'; setAction(); el('message').textContent = `Applied ${next.length} playback steps.`;
};
el('reset').onclick = () => { order = [...art.sequence]; el('order').value = order.join(', '); el('speed').value = String(art.frameMs); el('speedValue').textContent = String(art.frameMs); el('action').value = 'attack'; setAction(); el('message').textContent = 'Original order and timing restored.'; };
el('export').onclick = () => {
  const settings = {motionProfile:art.motionProfile, rightGroup:'empty', leftGroup:'empty', classId:art.classId, armourId:art.armourId, frames:order, frameMs:Number(el('speed').value), approval:'review-settings-only'};
  el('settingsJson').value = JSON.stringify(settings,null,2)+'\n';
  el('settingsJson').hidden = false; el('settingsJson').focus(); el('settingsJson').select();
  el('message').textContent = 'Sequence JSON is selected below. Copy it to keep your settings.';
};
const appearances = new Set(collection.expansion.map(r => r.appearanceId));
el('planSummary').textContent = `${collection.expansion.length} armor entries across four classes map to ${appearances.size} distinct appearances. All gallery figures share the selected action, order and timing. Catalog aliases are listed below.`;
for (const classId of ['reaver','starseer','herald','rogue']) {
  const details = document.createElement('details'); details.open = true;
  const summary = document.createElement('summary'); summary.textContent = classId[0].toUpperCase()+classId.slice(1); details.append(summary);
  const list = document.createElement('ul');
  for (const row of collection.expansion.filter(r => r.classId === classId)) {
    const item = document.createElement('li'); item.className = row.status === 'missing' ? 'planned' : '';
    item.textContent = `${row.name} (${row.armourId}) → ${row.appearanceId} · ${row.status}`;
    list.append(item);
  }
  details.append(list); el('expansion').append(details);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
render();
