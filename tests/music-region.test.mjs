// tests/music-region.test.mjs — the map's music follows its region.
//
// A region the music folder names plays its own tracks; a region it leaves
// empty borrows the plain `map` list; with neither, the region still has a
// procedural bed (it shares the map's), so no region is ever silent by bug.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { installWebAudioStub, stubGraph } = await import('../tools/webaudio-stub.mjs');
installWebAudioStub();
const graph = stubGraph();

const FOLDER = 'https://music.example/pack';
let manifest = {};
globalThis.fetch = async (url) => (String(url) === `${FOLDER}/manifest.json`
  ? { ok: true, json: async () => manifest }
  : { ok: false, json: async () => ({}) });

const { initAudio } = await import('../src/ui/audio.js');
const { BEDS, MAP_REGIONS, mapMusicContext } = await import('../src/content/music.js');
const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });

async function play(context) {
  await engine.configureMusic({ folder: FOLDER });
  engine.music('title');
  engine.stopMusic(0);
  graph.reset();
  const disposition = engine.music(context);
  return { disposition, srcs: graph.elements.map((el) => el.src) };
}

test('every region has a context with a bed, and unknown regions use plain map', () => {
  for (const id of MAP_REGIONS) {
    assert.equal(mapMusicContext(id), `map-${id}`);
    assert.ok(BEDS[`map-${id}`] && typeof BEDS[`map-${id}`] === 'object', `bed for ${id}`);
  }
  assert.equal(mapMusicContext('nowhere'), 'map');
  assert.equal(mapMusicContext(undefined), 'map');
});

test('a region plays its own tracks when the folder names them', async () => {
  manifest = { map: ['map/any.mp3'], 'map-pale-marches': ['marches/rime.mp3'] };
  const { disposition, srcs } = await play('map-pale-marches');
  assert.equal(disposition, 'external');
  assert.deepEqual([...new Set(srcs)], [`${FOLDER}/marches/rime.mp3`]);
});

test('a region the folder leaves empty borrows the plain map list', async () => {
  manifest = { map: ['map/any.mp3'] };
  const { disposition, srcs } = await play('map-cinder-reach');
  assert.equal(disposition, 'external');
  assert.deepEqual([...new Set(srcs)], [`${FOLDER}/map/any.mp3`]);
});

test('with no map tracks at all, a region plays the procedural bed', async () => {
  manifest = { boss: ['boss/x.mp3'] };
  const { disposition } = await play('map-drowned-coast');
  engine.stopMusic(0); // the bed schedules notes on a timer; release it so the run ends
  assert.equal(disposition, 'bed');
});
