// tests/serve-watch.test.mjs — tools/serve.mjs --watch (live reload).
//
// Starts the real server as a child process on a throwaway copy of a minimal
// tree, so nothing here touches the checkout. Covers: a file change arrives as
// `event: reload` within 2 s (with recursive fs.watch and with the
// per-directory fallback); a failed build arrives as `event: error` with the
// stderr tail and no reload; index.html carries the listener only in watch
// mode; and without --watch the served index.html is byte-identical to the
// file on disk and the event stream does not exist.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { buildToolFor } from '../tools/serve.mjs';

const SERVE = fileURLToPath(new URL('../tools/serve.mjs', import.meta.url));
const INDEX = '<!doctype html>\n<html><head><meta charset="utf-8"><title>t</title></head>\n<body><p>hello</p></body></html>\n';
const cleanups = [];
after(() => { for (const fn of cleanups.reverse()) { try { fn(); } catch { /* already gone */ } } });

test('authored directory replacement selects its builder without matching sibling names', () => {
  for (const [path, builder] of [
    ['content/source', 'content-build.mjs'],
    ['content/config', 'config-build.mjs'],
    ['content/hud-layout', 'hud-layout-css.mjs'],
    ['content/framework', 'framework-data-build.mjs'],
    ['games', 'game-config.mjs build'],
    ...['modules', 'foundation', 'contracts', 'kernel', 'runtime'].map(name => [`engine/${name}`, 'game-config.mjs build']),
  ]) {
    assert.equal(buildToolFor(path), builder, path);
    assert.equal(buildToolFor(`${path}/authored.json`), builder, `${path}/authored.json`);
    assert.equal(buildToolFor(`${path}-backup`), null, `${path}-backup`);
    assert.equal(buildToolFor(`${path}-backup/authored.json`), null, `${path}-backup/authored.json`);
  }
  assert.equal(buildToolFor('content/config/notes.txt'), null);
});

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), 'serve-watch-'));
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  mkdirSync(join(root, 'content', 'source'), { recursive: true });
  mkdirSync(join(root, 'content', 'config'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'index.html'), INDEX);
  writeFileSync(join(root, 'src', 'main.js'), 'export const a = 1;\n');
  writeFileSync(join(root, 'src', 'deep', 'x.js'), 'export const x = 1;\n');
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

/** Start serve.mjs; resolves { port, child } once it prints its address. */
function start(root, extraArgs = [], env = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SERVE, '--port', '0', '--no-open', '--no-lan', '--root', root, ...extraArgs],
      { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    cleanups.push(() => child.kill());
    let out = '';
    const timer = setTimeout(() => fail(new Error(`serve did not start: ${out}`)), 8000);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/live at http:\/\/localhost:(\d+)\//);
      if (m) { clearTimeout(timer); done({ port: Number(m[1]), child }); }
    });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('exit', (code) => { clearTimeout(timer); fail(new Error(`serve exited early (${code}): ${out}`)); });
  });
}

function get(port, path) {
  return new Promise((done, fail) => {
    request({ host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', fail).end();
  });
}

/** Open the event stream; `next(name, ms)` resolves with the data of the next event of that name. */
function events(port) {
  return new Promise((ready, fail) => {
    const req = request({ host: '127.0.0.1', port, path: '/__dev/events' }, (res) => {
      let buffer = '';
      const waiters = [];
      const seen = [];
      res.setEncoding('utf8');
      res.on('data', (text) => {
        buffer += text;
        let at;
        while ((at = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          const name = /^event: (.*)$/m.exec(block)?.[1];
          if (!name) continue;
          const data = [...block.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join('\n');
          seen.push({ name, data });
          for (const w of [...waiters]) if (w.name === name) { waiters.splice(waiters.indexOf(w), 1); w.done(data); }
        }
      });
      cleanups.push(() => req.destroy());
      ready({
        status: res.statusCode,
        type: res.headers['content-type'],
        seen,
        next: (name, ms) => new Promise((done, giveUp) => {
          const w = { name, done };
          waiters.push(w);
          setTimeout(() => { if (waiters.includes(w)) { waiters.splice(waiters.indexOf(w), 1); giveUp(new Error(`no ${name} event within ${ms} ms`)); } }, ms);
        }),
        close: () => req.destroy(),
      });
    });
    req.on('error', fail).end();
  });
}

for (const [label, env] of [['recursive fs.watch', {}], ['per-directory watchers', { SERVE_WATCH_NO_RECURSIVE: '1' }]]) {
  test(`--watch: a changed file arrives as a reload event within 2 s (${label})`, async () => {
    const root = makeTree();
    const { port, child } = await start(root, ['--watch'], env);
    const stream = await events(port);
    assert.equal(stream.status, 200);
    assert.match(stream.type, /^text\/event-stream/);
    const reload = stream.next('reload', 2000);
    writeFileSync(join(root, 'src', 'deep', 'x.js'), 'export const x = 2;\n');
    assert.equal(await reload, 'src/deep/x.js');
    // A directory created after start is watched too.
    mkdirSync(join(root, 'src', 'later'));
    await new Promise((r) => setTimeout(r, 400));
    const again = stream.next('reload', 2000);
    writeFileSync(join(root, 'src', 'later', 'y.js'), 'export const y = 1;\n');
    assert.equal(await again, 'src/later/y.js');
    stream.close();
    child.kill();
  });
}

// Replacing a WATCHED directory (rm + mkdir, or a rename over it) is a POSIX
// scenario: on Windows the per-directory handle (ReadDirectoryChangesW) keeps
// the directory from being renamed or removed while it is open, and that
// fallback never runs there anyway — fs.watch is recursive on Windows, so the
// one handle sits on the target root and its subdirectories come and go
// freely. The two tests below therefore assert the fallback's behaviour where
// the fallback is used.
const REPLACES_WATCHED_DIR = process.platform === 'win32'
  && 'the per-directory fallback never runs on Windows (fs.watch is recursive there), and a watched directory cannot be renamed or removed while its handle is open';

test('--watch: a directory deleted and recreated is watched on its new inode (per-directory watchers)', { skip: REPLACES_WATCHED_DIR }, async () => {
  const root = makeTree();
  const { port, child } = await start(root, ['--watch'], { SERVE_WATCH_NO_RECURSIVE: '1' });
  const stream = await events(port);
  mkdirSync(join(root, 'src', 'later'));
  await new Promise((r) => setTimeout(r, 400));
  const first = stream.next('reload', 2000);
  writeFileSync(join(root, 'src', 'later', 'y.js'), 'export const y = 1;\n');
  assert.equal(await first, 'src/later/y.js');
  // (each step waits out the debounce + post-build quiet window, 150 + 300 ms)
  rmSync(join(root, 'src', 'later'), { recursive: true, force: true });
  await new Promise((r) => setTimeout(r, 600));
  mkdirSync(join(root, 'src', 'later'));
  await new Promise((r) => setTimeout(r, 600));
  const reborn = stream.next('reload', 2000);
  writeFileSync(join(root, 'src', 'later', 'z.js'), 'export const z = 1;\n');
  assert.equal(await reborn, 'src/later/z.js');
  stream.close();
  child.kill();
});

test('--watch: replacing content/source rebuilds before reload and watches the replacement', { skip: REPLACES_WATCHED_DIR }, async () => {
  const root = makeTree();
  mkdirSync(join(root, 'src', 'generated'), { recursive: true });
  writeFileSync(join(root, 'src', 'generated', 'value.json'), '{"value":"old"}\n');
  writeFileSync(join(root, 'tools', 'content-build.mjs'),
    "import { readFileSync, writeFileSync } from 'node:fs';\n" +
    "writeFileSync('src/generated/value.json', readFileSync('content/source/value.json'));\n");
  mkdirSync(join(root, 'replacement'));
  writeFileSync(join(root, 'replacement', 'value.json'), '{"value":"replacement"}\n');
  const { port, child } = await start(root, ['--watch'], { SERVE_WATCH_NO_RECURSIVE: '1' });
  const stream = await events(port);
  const reload = stream.next('reload', 3000);
  renameSync(join(root, 'content', 'source'), join(root, 'previous-source'));
  renameSync(join(root, 'replacement'), join(root, 'content', 'source'));
  await reload;
  assert.equal(JSON.parse(readFileSync(join(root, 'src', 'generated', 'value.json'), 'utf8')).value, 'replacement');
  const again = stream.next('reload', 3000);
  writeFileSync(join(root, 'content', 'source', 'value.json'), '{"value":"edited"}\n');
  await again;
  assert.equal(JSON.parse(readFileSync(join(root, 'src', 'generated', 'value.json'), 'utf8')).value, 'edited');
  stream.close();
  child.kill();
});

test('--watch: a failed build sends the stderr tail as an error event and no reload', async () => {
  const root = makeTree();
  writeFileSync(join(root, 'tools', 'content-build.mjs'), 'for (let i = 0; i < 30; i++) console.error(`line ${i}`);\nprocess.exit(1);\n');
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const error = stream.next('error', 3000);
  writeFileSync(join(root, 'content', 'source', 'cards.json'), '{}\n');
  const text = await error;
  const lines = text.split('\n');
  assert.equal(lines.length, 20, 'the last 20 lines');
  assert.equal(lines[0], 'line 10');
  assert.equal(lines[19], 'line 29');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(!stream.seen.some((e) => e.name === 'reload'), 'a failed build does not reload');
  // The build passes once fixed: reload follows.
  writeFileSync(join(root, 'tools', 'content-build.mjs'), 'process.exit(0);\n');
  const reload = stream.next('reload', 3000);
  writeFileSync(join(root, 'content', 'source', 'cards.json'), '{"a":1}\n');
  assert.equal(await reload, 'content/source/cards.json');
  stream.close();
  child.kill();
});

test('--watch: an edit saved while a build runs is not dropped (error, then reload)', async () => {
  const root = makeTree();
  // Reads its verdict when it starts, then takes 1 s: a slow build.
  writeFileSync(join(root, 'tools', 'config-build.mjs'),
    "import { existsSync } from 'node:fs';\nconst bad = existsSync('fail.flag');\n" +
    "await new Promise((r) => setTimeout(r, 1000));\nif (bad) console.error('config is bad');\nprocess.exit(bad ? 1 : 0);\n");
  writeFileSync(join(root, 'fail.flag'), '');
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const error = stream.next('error', 4000);
  writeFileSync(join(root, 'content', 'config', 'a.json'), '{"bad":true}\n');
  await new Promise((r) => setTimeout(r, 600)); // the 1 s build is running now
  rmSync(join(root, 'fail.flag'));
  const reload = stream.next('reload', 4000);
  writeFileSync(join(root, 'content', 'config', 'a.json'), '{"bad":false}\n');
  assert.equal(await error, 'config is bad');
  assert.equal(await reload, 'content/config/a.json');
  stream.close();
  child.kill();
});

test('--watch: a content/hud-layout change runs hud-layout-css, reloads, and ignores its generated CSS', async () => {
  const root = makeTree();
  mkdirSync(join(root, 'content', 'hud-layout'), { recursive: true });
  mkdirSync(join(root, 'styles'), { recursive: true });
  const log = join(root, 'order.log');
  writeFileSync(join(root, 'tools', 'hud-layout-css.mjs'),
    "import { appendFileSync, writeFileSync } from 'node:fs';\n" +
    `appendFileSync(${JSON.stringify(log)}, 'hud-layout-css\\n');\n` +
    "writeFileSync('styles/hud-layout.generated.css', ':root{}\\n');\n");
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const reload = stream.next('reload', 3000);
  writeFileSync(join(root, 'content', 'hud-layout', 'mobile.json'), '{}\n');
  assert.equal(await reload, 'content/hud-layout/mobile.json');
  await new Promise((r) => setTimeout(r, 600)); // its own CSS write must not start another round
  assert.equal(readFileSync(log, 'utf8'), 'hud-layout-css\n');
  assert.equal(stream.seen.filter((e) => e.name === 'reload').length, 1);
  stream.close();
  child.kill();
});

test('--watch: a content/framework change runs framework-data-build, reloads once, ignores its src/framework/data output', async () => {
  const root = makeTree();
  mkdirSync(join(root, 'content', 'framework'), { recursive: true });
  mkdirSync(join(root, 'src', 'framework', 'data'), { recursive: true });
  const log = join(root, 'order.log');
  writeFileSync(join(root, 'tools', 'framework-data-build.mjs'),
    "import { appendFileSync, writeFileSync } from 'node:fs';\n" +
    `appendFileSync(${JSON.stringify(log)}, 'framework-data-build\\n');\n` +
    "writeFileSync('src/framework/data/assets.js', 'export const assets = {};\\n');\n");
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const reload = stream.next('reload', 3000);
  writeFileSync(join(root, 'content', 'framework', 'assets.json'), '{}\n');
  assert.equal(await reload, 'content/framework/assets.json');
  await new Promise((r) => setTimeout(r, 600)); // its own data write must not start another round
  assert.equal(readFileSync(log, 'utf8'), 'framework-data-build\n');
  assert.equal(stream.seen.filter((e) => e.name === 'reload').length, 1);
  stream.close();
  child.kill();
});

test('--watch: a games/ change runs `game-config build`, reloads once, ignores game.lock.json and generated output', async () => {
  const root = makeTree();
  mkdirSync(join(root, 'games', 'ashenspire', 'presets'), { recursive: true });
  mkdirSync(join(root, 'src', 'content', 'generated'), { recursive: true });
  mkdirSync(join(root, 'engine', 'modules', 'm'), { recursive: true });
  const log = join(root, 'order.log');
  writeFileSync(join(root, 'tools', 'game-config.mjs'),
    "import { appendFileSync, writeFileSync } from 'node:fs';\n" +
    `appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n');\n` +
    "writeFileSync('games/ashenspire/game.lock.json', '{}\\n');\n" +
    "writeFileSync('src/content/generated/gameProfiles.js', 'export const g = 1;\\n');\n");
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const reload = stream.next('reload', 3000);
  writeFileSync(join(root, 'games', 'ashenspire', 'presets', 'core.json'), '{}\n');
  assert.equal(await reload, 'games/ashenspire/presets/core.json');
  await new Promise((r) => setTimeout(r, 600)); // the lock-file write must not start another round
  assert.equal(readFileSync(log, 'utf8'), 'build\n', 'ran once, with the build subcommand');
  assert.equal(stream.seen.filter((e) => e.name === 'reload').length, 1);
  // engine/modules/ maps to the same builder.
  const again = stream.next('reload', 3000);
  writeFileSync(join(root, 'engine', 'modules', 'm', 'module.json'), '{}\n');
  assert.equal(await again, 'engine/modules/m/module.json');
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(readFileSync(log, 'utf8'), 'build\nbuild\n');
  stream.close();
  child.kill();
});

test('--watch: a batch touching config, hud-layout and source runs the builders in a fixed order', async () => {
  const root = makeTree();
  mkdirSync(join(root, 'content', 'hud-layout'), { recursive: true });
  mkdirSync(join(root, 'content', 'framework'), { recursive: true });
  mkdirSync(join(root, 'games'), { recursive: true });
  const log = join(root, 'order.log');
  for (const tool of ['config-build', 'hud-layout-css', 'framework-data-build', 'content-build', 'game-config']) {
    writeFileSync(join(root, 'tools', `${tool}.mjs`),
      `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, ${JSON.stringify(`${tool}\n`)});\n`);
  }
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const reload = stream.next('reload', 3000);
  // Source first, so insertion order alone would run content-build first.
  writeFileSync(join(root, 'content', 'source', 'cards.json'), '{}\n');
  writeFileSync(join(root, 'games', 'g.json'), '{}\n');
  writeFileSync(join(root, 'content', 'framework', 'assets.json'), '{}\n');
  writeFileSync(join(root, 'content', 'hud-layout', 'mobile.json'), '{}\n');
  writeFileSync(join(root, 'content', 'config', 'a.json'), '{}\n');
  await reload;
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['config-build', 'hud-layout-css', 'framework-data-build', 'content-build', 'game-config']);
  stream.close();
  child.kill();
});

test('--watch: a builder an earlier failure skipped runs in the next round, and engine/kernel edits rebuild the profiles', async () => {
  const root = makeTree();
  mkdirSync(join(root, 'engine', 'kernel'), { recursive: true });
  const log = join(root, 'order.log');
  const fake = (tool, body = '') => writeFileSync(join(root, 'tools', `${tool}.mjs`),
    `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, ${JSON.stringify(`${tool}\n`)});\n${body}`);
  fake('config-build', 'console.error("bad config"); process.exit(1);\n');
  fake('content-build');
  fake('game-config');
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  const error = stream.next('error', 3000);
  writeFileSync(join(root, 'content', 'source', 'cards.json'), '{}\n');
  writeFileSync(join(root, 'content', 'config', 'a.json'), '{}\n');
  await error;
  // config-build failed, so content-build never ran and is owed.
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['config-build']);
  fake('config-build'); // the fix
  const reload = stream.next('reload', 3000);
  writeFileSync(join(root, 'content', 'config', 'a.json'), '{"fixed":1}\n');
  await reload;
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['config-build', 'config-build', 'content-build']);
  const reload2 = stream.next('reload', 3000);
  writeFileSync(join(root, 'engine', 'kernel', 'kernel.json'), '{}\n');
  await reload2;
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').at(-1), 'game-config');
  stream.close();
  child.kill();
});

test('--watch: index.html replaced by rename (an editor\'s atomic save) reloads every time', async () => {
  const root = makeTree();
  const { port, child } = await start(root, ['--watch']);
  const stream = await events(port);
  for (const n of [1, 2]) {
    const reload = stream.next('reload', 2000);
    writeFileSync(join(root, 'index.html.new'), INDEX.replace('hello', `saved ${n}`));
    renameSync(join(root, 'index.html.new'), join(root, 'index.html'));
    assert.equal(await reload, 'index.html', `rename ${n}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  stream.close();
  child.kill();
});

test('--watch: index.html (only) carries the live-reload listener', async () => {
  const root = makeTree();
  const { port, child } = await start(root, ['--watch']);
  const html = (await get(port, '/')).body.toString('utf8');
  assert.ok(html.startsWith(INDEX.slice(0, INDEX.indexOf('</body>'))));
  assert.match(html, /new EventSource\('\/__dev\/events'\)/);
  assert.ok(html.indexOf('<script>') < html.indexOf('</body>'), 'the script goes before </body>');
  assert.equal(html.match(/<script>[\s\S]*<\/script>/)[0].split('\n').length <= 25, true, 'at most 25 lines');
  assert.equal((await get(port, '/src/main.js')).body.toString('utf8'), 'export const a = 1;\n');
  child.kill();
});

test('without --watch: index.html is byte-identical to the file on disk and there is no event stream', async () => {
  const root = makeTree();
  const { port, child } = await start(root);
  const served = await get(port, '/');
  assert.equal(served.status, 200);
  assert.ok(served.body.equals(readFileSync(join(root, 'index.html'))), 'index.html served unchanged');
  assert.ok((await get(port, '/index.html')).body.equals(readFileSync(join(root, 'index.html'))));
  assert.equal((await get(port, '/__dev/events')).status, 404);
  child.kill();
});
