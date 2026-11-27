import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../../../../tools/serve.mjs';
import { artPath } from '../../../../../tools/art-source.mjs';

const config =
{
    baseline: '49eca254d795d06266aa23941cb2b31fe77b27bf',
    playwrightModule: process.env.PLAYWRIGHT_MODULE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.js',
    port: 8339,
    seed: 'SPRITEAUDIT20261126',
    viewports:
    [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
    ],
    classes: ['reaver', 'starseer'],
    readyTimeoutMs: 30000,
    settleMs: 1000,
    settings:
    {
        effects: false,
        haptics: false,
        motionHit: true,
        reducedMotion: false,
        animSpeed: 'slow',
        viewPreset: 'auto',
        screenShake: false,
    },
};

function digest(bytes)
{
    return createHash('sha256').update(bytes).digest('hex');
}

function git(root, args)
{
    return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8' }).trim();
}

function readArgument(name)
{
    const index = process.argv.indexOf(name);
    return index < 0
        ? null
        : process.argv[index + 1];
}

const mode = readArgument('--mode');
const expectedCommit = readArgument('--expected-commit');
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const actualCommit = git(root, ['rev-parse', 'HEAD']);

if (!['before', 'after'].includes(mode) || expectedCommit !== actualCommit)
{
    throw new Error('Supply --mode before|after and --expected-commit matching the actual HEAD.');
}

const sourceChanges = git(root, ['status', '--porcelain', '--', 'src', 'content', 'styles', 'art-release.json', 'art-manifest.json']);

if (sourceChanges)
{
    throw new Error('Commit candidate source/art metadata before collecting labeled evidence: ' + sourceChanges);
}

if (mode === 'before')
{
    const sourceIndex = JSON.parse(readFileSync(new URL('../../measurements/source-hashes.json', import.meta.url)));

    for (const file of sourceIndex.files)
    {
        const text = readFileSync(join(root, file.path), 'utf8').replace(/\r\n/g, '\n');

        if (digest(text) !== file.lfNormalizedSha256)
        {
            throw new Error(`Before source differs from retained baseline: ${file.path}`);
        }
    }
}

const outputName = readArgument('--output-name') || mode;

if (!/^[a-z0-9-]+$/.test(outputName))
{
    throw new Error('Output name must be a simple directory name.');
}

const output = fileURLToPath(new URL(outputName + '/', import.meta.url));

if (existsSync(output))
{
    throw new Error(`Refusing to overwrite existing ${mode} evidence: ${output}`);
}

mkdirSync(output, { recursive: true });

const artRelease = JSON.parse(readFileSync(join(root, 'art-release.json'), 'utf8'));
const { chromium } = createRequire(import.meta.url)(config.playwrightModule);
const server = await serve({ root, port: config.port, host: '127.0.0.1', open: false, quiet: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const record =
{
    mode,
    sourceCommit: actualCommit,
    sourceBaseline: config.baseline,
    artRelease,
    capturedAt: new Date().toISOString(),
    browser: browser.version(),
    seed: config.seed,
    kind: 'Full-game developer combat fixture; presentation methods sampled directly, not engine-dispatched actions',
    captures: [],
    failures: [],
};

try
{
    for (const viewport of config.viewports)
    {
        for (const classId of config.classes)
        {
            const page = await browser.newPage({ viewport, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
            const pageErrors = [];

            page.on('pageerror', (error) => pageErrors.push(error.message));

            const parameters = new URLSearchParams(
            {
                shot: 'combat',
                gameProfile: 'core',
                shotClass: classId,
                shotSeed: config.seed,
                shotEnemyCount: '1',
                shotSettings: JSON.stringify(config.settings),
            });
            const url = server.url + 'index.html?' + parameters;

            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() =>
            {
                return document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt;
            }, null, { timeout: config.readyTimeoutMs });
            await page.evaluate(async () =>
            {
                await document.fonts.ready;
            });
            await page.waitForTimeout(config.settleMs);

            const samples = classId === 'reaver'
                ? ['ready', 'sweep-held', 'sweep-contact']
                : ['ready', 'hit', 'returned-ready'];

            for (const sample of samples)
            {
                if (sample === 'hit' && mode === 'before')
                {
                    await page.evaluate(() =>
                    {
                        const stage = document.querySelector('.combatant.player .pose-stage').__poseStage;

                        if (!stage.play('hit', 6000))
                        {
                            throw new Error('Normal-motion hit was refused by the actual game stage.');
                        }

                        stage.hold(10000);
                    });
                    await page.waitForFunction(() =>
                    {
                        const stage = document.querySelector('.combatant.player .pose-stage').__poseStage;
                        return stage.currentArt.image.currentSrc.includes('/HURT.webp');
                    }, null, { timeout: config.readyTimeoutMs });
                }

                const receipt = await page.evaluate((sample) =>
                {
                    const frame = document.querySelector('.combatant.player');
                    const stage = frame.querySelector('.pose-stage').__poseStage;

                    if (sample === 'sweep-held')
                    {
                        stage.setStance('sweep');
                    }

                    if (sample === 'sweep-contact')
                    {
                        stage.seek('sweep', 270, 600);
                    }

                    if (sample === 'hit')
                    {
                        stage.play('hit', 6000);
                        stage.hold(10000);
                    }

                    if (sample === 'returned-ready')
                    {
                        stage.endReaction();
                    }

                    const art = stage.currentArt;
                    const bounds = (element) => element?.getBoundingClientRect().toJSON() || null;

                    return {
                        pose: stage.pose,
                        stance: stage.stance,
                        imageUrl: art.image.currentSrc,
                        raster: [art.image.naturalWidth, art.image.naturalHeight],
                        drawCanvas: [art.left, art.top, art.width, art.height],
                        body: art.body || null,
                        presentation: stage.presentation,
                        frame: bounds(frame),
                        sprite: bounds(frame.querySelector('.sprite')),
                        miniHud: bounds(frame.querySelector('.combatant-mini-hud')),
                        field: bounds(document.querySelector('.field')),
                        rootDataset: { ...document.documentElement.dataset },
                        stageDataset: { ...stage.el.dataset },
                        bodyClasses: document.body.className,
                        eventLogLength: window.__combat.eventLog.length,
                    };
                }, sample);
                const filename = `${classId}-${sample}-${viewport.width}-${mode}.png`;
                const png = await page.screenshot({ path: join(output, filename) });
                const assetId = new URL(receipt.imageUrl).pathname.slice(1);
                const asset = artPath(assetId, { root });

                record.captures.push(
                {
                    file: filename,
                    bytes: png.length,
                    sha256: digest(png),
                    viewport,
                    classId,
                    sample,
                    url,
                    settings: config.settings,
                    assetId,
                    assetSha256: digest(readFileSync(asset)),
                    receipt,
                });
                console.log(filename, receipt.pose, receipt.drawCanvas[3]);
            }

            if (pageErrors.length)
            {
                record.failures.push({ classId, viewport, pageErrors });
            }

            await page.close();
        }
    }
}
finally
{
    writeFileSync(join(output, 'capture-record.json'), JSON.stringify(record, null, 2) + '\n');
    await browser.close();
    await new Promise((resolve) => server.server.close(resolve));
}

if (record.failures.length)
{
    throw new Error('Capture recorded page errors; inspect the immutable capture record.');
}
