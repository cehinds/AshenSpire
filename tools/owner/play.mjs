#!/usr/bin/env node
// npm run play: builds and checks your edits, then opens the game with live reload.
// Saving a JSON file rebuilds and reloads the page. Extra flags (--port 8090) go to the server.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { BuildAndCheck } from './check.mjs';
import {
    FormatText,
    OWNER_TEXT,
    OWNER_TOOLS,
    REPO_ROOT,
} from './ownerConfig.mjs';
import { RunNode } from './ownerProcess.mjs';

const PLAY = OWNER_TOOLS.play;
const TEXT = OWNER_TEXT.play;
const ENEMY_SHEET_BUILD = OWNER_TOOLS.buildSteps.find((step) => step.label === PLAY.enemySheetStep);
const INHERIT_OUTPUT = 'inherit';
const CLEAN_EXIT = 0;

function isSheet(fileName)
{
    return Boolean(fileName)
        && fileName.endsWith(PLAY.enemySheetExtension)
        && !fileName.startsWith(PLAY.generatedSheetPrefix);
}

function rebuildSheet(fileName)
{
    const result = RunNode(ENEMY_SHEET_BUILD.args);
    const template = result.ok
        ? TEXT.sheetRebuilt
        : TEXT.sheetError;
    console.log(FormatText(template, {
        file: fileName,
        output: result.output,
    }));
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
        process.exit(code ?? CLEAN_EXIT);
    });
}

function main()
{
    if (!BuildAndCheck())
    {
        console.log(TEXT.failed);
    }
    watchEnemySheets();
    startServer();
    TEXT.ready.forEach((note) => console.log(note));
}

main();
