#!/usr/bin/env node
// npm run play: builds and checks your edits, then opens the game with live reload.
// Saving a JSON file rebuilds and reloads the page. Extra flags (--port 8090) go to the server.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { BuildAndCheck } from './check.mjs';
import { OWNER_TOOLS, REPO_ROOT, RunNode } from './ownerSteps.mjs';

const ENEMY_SHEET_BUILD = OWNER_TOOLS.buildSteps.find((step) => step.label === OWNER_TOOLS.play.enemySheetStep);
const JSON_EXTENSION = '.json';
const GENERATED_PREFIX = '_';

/** The server rebuilds content on save; enemy sheets need their own write step first. */
function watchEnemySheets()
{
    const folder = join(REPO_ROOT, OWNER_TOOLS.play.enemySheetFolder);
    let timer = null;
    let writing = false;
    watch(folder, (eventType, fileName) =>
    {
        const isSheet = fileName && fileName.endsWith(JSON_EXTENSION) && !fileName.startsWith(GENERATED_PREFIX);
        if (!isSheet || writing)
        {
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(() =>
        {
            writing = true;
            const result = RunNode(ENEMY_SHEET_BUILD.args);
            console.log(result.ok
                ? `play: enemy sheet ${fileName} rebuilt`
                : `play: enemy sheet ${fileName} has an error:\n${result.output}`);
            setTimeout(() =>
            {
                writing = false;
            }, OWNER_TOOLS.play.rebuildDelayMs);
        }, OWNER_TOOLS.play.rebuildDelayMs);
    });
}

function main()
{
    if (!BuildAndCheck())
    {
        console.log('\nA check failed. The game still opens, but fix the file named above first.');
    }
    watchEnemySheets();
    const serverArgs = [
        ...OWNER_TOOLS.play.serverArgs,
        ...process.argv.slice(2),
    ];
    const server = spawn(process.execPath, serverArgs, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });
    server.on('exit', (code) =>
    {
        process.exit(code ?? 0);
    });
    console.log('\nThe game opens in your browser. Score Studio: /tools/score-studio/');
    console.log('Edit a JSON file and save: the page reloads. Press Ctrl+C here to stop.');
}

main();
