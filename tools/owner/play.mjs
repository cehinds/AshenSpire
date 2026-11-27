#!/usr/bin/env node
// npm run play: builds and checks your edits, then opens the game with live reload.
// Saving a JSON file rebuilds and reloads the page. Extra flags (--port 8090) go to the server.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { BuildAndCheck } from './check.mjs';
import { OWNER_TOOLS, REPO_ROOT } from './ownerConfig.mjs';
import { RunNode } from './ownerProcess.mjs';

const PLAY = OWNER_TOOLS.play;
const ENEMY_SHEET_BUILD = OWNER_TOOLS.buildSteps.find((step) => step.label === PLAY.enemySheetStep);
const JSON_EXTENSION = '.json';
const GENERATED_PREFIX = '_';
const INHERIT_OUTPUT = 'inherit';
const FAILED_NOTE = '\nA check failed. The game still opens, but fix the file named above first.';
const READY_NOTES = [
    '\nThe game opens in your browser. Score Studio: /tools/score-studio/',
    'Edit a JSON file and save: the page reloads. Press Ctrl+C here to stop.',
];

function isSheet(fileName)
{
    return Boolean(fileName)
        && fileName.endsWith(JSON_EXTENSION)
        && !fileName.startsWith(GENERATED_PREFIX);
}

function rebuildSheet(fileName)
{
    const result = RunNode(ENEMY_SHEET_BUILD.args);
    console.log(result.ok
        ? `play: enemy sheet ${fileName} rebuilt`
        : `play: enemy sheet ${fileName} has an error:\n${result.output}`);
}

/** The server rebuilds content on save; enemy sheets need their own write step first. */
function watchEnemySheets()
{
    const folder = join(REPO_ROOT, PLAY.enemySheetFolder);
    let timer = null;
    let writing = false;
    const settle = () =>
    {
        writing = false;
    };
    watch(folder, (eventType, fileName) =>
    {
        if (!isSheet(fileName) || writing)
        {
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(() =>
        {
            writing = true;
            rebuildSheet(fileName);
            setTimeout(settle, PLAY.rebuildDelayMs);
        }, PLAY.rebuildDelayMs);
    });
}

function startServer()
{
    const serverArgs = [
        ...PLAY.serverArgs,
        ...process.argv.slice(2),
    ];
    const server = spawn(process.execPath, serverArgs, {
        cwd: REPO_ROOT,
        stdio: INHERIT_OUTPUT,
    });
    server.on('exit', (code) =>
    {
        process.exit(code ?? 0);
    });
}

function main()
{
    if (!BuildAndCheck())
    {
        console.log(FAILED_NOTE);
    }
    watchEnemySheets();
    startServer();
    READY_NOTES.forEach((note) => console.log(note));
}

main();
