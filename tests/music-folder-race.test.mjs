// tests/music-folder-race.test.mjs — a music-folder manifest that resolves
// after a newer configureMusic() call must not overwrite the newer choice.
//
// The shape it guards (#1274 review): with the setting blank, a hosted page
// starts fetching the shipped music/manifest.json at boot. A player who types
// their own folder before that answer lands starts a second fetch; the slow
// shipped answer used to arrive last and win, playing the bundled tracks while
// Settings showed the custom folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { installWebAudioStub, stubGraph } = await import('../tools/webaudio-stub.mjs');
installWebAudioStub();
const graph = stubGraph();

const SHIPPED = 'music';
const CUSTOM = 'https://music.example/pack';
let releaseShipped;
const shippedGate = new Promise((r) => { releaseShipped = r; });
globalThis.fetch = async (url) => {
  if (String(url) === `${SHIPPED}/manifest.json`) {
    await shippedGate;
    return { ok: true, json: async () => ({ map: ['map/shipped.mp3'] }) };
  }
  if (String(url) === `${CUSTOM}/manifest.json`) return { ok: true, json: async () => ({ map: ['map/custom.mp3'] }) };
  return { ok: false, json: async () => ({}) };
};

const { initAudio } = await import('../src/ui/audio.js');

test('a stale shipped manifest does not overwrite a newer custom folder', async () => {
  const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
  const slow = engine.configureMusic({ folder: SHIPPED });
  await engine.configureMusic({ folder: CUSTOM });
  releaseShipped();
  await slow;
  engine.music('title');
  engine.stopMusic(0);
  graph.reset();
  assert.equal(engine.music('map'), 'external');
  const srcs = graph.elements.map((el) => el.src);
  assert.ok(srcs.length > 0, 'an external track started');
  assert.ok(srcs.every((s) => s === `${CUSTOM}/map/custom.mp3`), `played ${srcs.join(', ')}`);
});
