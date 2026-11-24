#!/usr/bin/env node
// tools/score-studio/launch.mjs — start the local AshenSpire server and open Score Studio.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '4173';
const noOpen = process.argv.includes('--no-open');
const url = `http://localhost:${port}/tools/score-studio/`;

const child = spawn(process.execPath, [resolve(root, 'tools/serve.mjs'), '--host', 'localhost', '--port', port, '--no-open', '--editor-write'], {
  cwd: root,
  stdio: 'inherit',
});

if (!noOpen) {
  setTimeout(() => {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    console.log(`Score Studio: ${url}`);
  }, 600);
} else {
  console.log(`Score Studio ready at ${url}`);
}

child.on('exit', (code) => process.exit(code ?? 0));
