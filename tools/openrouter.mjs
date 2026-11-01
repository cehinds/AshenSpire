#!/usr/bin/env node
// tools/openrouter.mjs — ask a model through OpenRouter from the command line.
//
//   node tools/openrouter.mjs "prompt"            print the reply text
//   echo "prompt" | node tools/openrouter.mjs     prompt from stdin
//   node tools/openrouter.mjs --model <slug> "p"  pick a model (default: $OPENROUTER_MODEL or openrouter/auto)
//   node tools/openrouter.mjs --system "text" "p" add a system message
//   node tools/openrouter.mjs --check             verify the key; print usage and limit
//   node tools/openrouter.mjs --help
//
// The key is OPENROUTER_API_KEY in the shell or in .env at the repo root
// (gitignored). Dev tooling only: never import from src/. Zero dependencies.

import { openRouterKey, chat, verifyKey } from './lib/openrouter.mjs';

const HELP = `usage: node tools/openrouter.mjs [--model <slug>] [--system "<text>"] ["prompt"]
       node tools/openrouter.mjs --check
Prompt is read from stdin when not given. Key: OPENROUTER_API_KEY or .env at the repo root.`;

function parseArgs(argv) {
  const out = { rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--check') out.check = true;
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--system') out.system = argv[++i];
    else out.rest.push(a);
  }
  return out;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  const key = openRouterKey();
  if (args.check) {
    const { limit, usage } = await verifyKey({ key });
    console.log(`usage: ${usage}\nlimit: ${limit ?? 'none'}`);
    return;
  }
  let prompt = args.rest.join(' ').trim();
  if (!prompt && !process.stdin.isTTY) prompt = await readStdin();
  if (!prompt) { console.error(HELP); process.exitCode = 1; return; }
  const messages = [];
  if (args.system) messages.push({ role: 'system', content: args.system });
  messages.push({ role: 'user', content: prompt });
  const { text } = await chat({ messages, model: args.model, key });
  console.log(text);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
