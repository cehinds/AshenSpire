// Reproduce BEFORE-only captures using unchanged production modules and pinned art.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serve } from '../../../../tools/serve.mjs';
import { artPath } from '../../../../tools/art-source.mjs';

const captureConfig =
{
    sourceBaseline: '49eca254d795d06266aa23941cb2b31fe77b27bf',
    artTag: 'ashenspire-hd-assets-v30',
    port: 8338,
    host: '127.0.0.1',
    defaultBrowserChannel: 'msedge',
    viewports:
    [
        [1280, 800],
        [390, 844],
    ],
    classIds: ['reaver', 'starseer'],
    phoneWidth: 390,
    deviceScaleFactor: 1,
    sharedDiagnosticZoom: 0.52,
    captureReadyTimeoutMs: 30000,
    captureReadyPollingMs: 100,
    fullGameNavigationTimeoutMs: 60000,
    fullGameReadyTimeoutMs: 15000,
    fullGameSettleMs: 2000,
    limitedErrorLength: 200,
    drawHeightIndex: 3,
    printedDecimalPlaces: 3,
    jsonIndent: 2,
    successfulHttpStatus: 200,
    verificationPath: 'docs/planning/player-sprite-cleanup-2026-11-26/verification/',
    fullGameShotSeed: 'SPRITE-AUDIT-20261126',
};

function digest(bytes)
{
    return createHash('sha256').update(bytes).digest('hex');
}

function readJson(relativePath)
{
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url)));
}

function verifyRetainedSources(sourceHashes, root)
{
    for (const file of sourceHashes.files)
    {
        const sourceText = readFileSync(join(root, file.path), 'utf8');
        const actual = digest(sourceText.replace(/\r\n/g, '\n'));

        if (actual !== file.lfNormalizedSha256)
        {
            throw new Error(`Source differs from recorded baseline: ${file.path}`);
        }
    }
}

function verifyRetainedRasters(retainedRasterRows, root, release)
{
    for (const file of retainedRasterRows)
    {
        if (!file.exists)
        {
            continue;
        }

        const cachePath = join(root, '.art-cache', release, file.pack, file.path);
        const bytes = readFileSync(cachePath);

        if (bytes.length !== file.bytes || digest(bytes) !== file.sha256)
        {
            throw new Error(`Pinned raster differs from retained baseline: ${file.pack}/${file.path}`);
        }
    }
}

async function verifyLoadedImage(receipt, retainedRasterRows, root)
{
    const assetId = new URL(receipt.src).pathname.slice(1);
    const filePath = artPath(assetId, { root });
    const response = await fetch(receipt.src);
    const bytes = Buffer.from(await response.arrayBuffer());

    receipt.assetId = assetId;
    receipt.loadedImageHttpStatus = response.status;
    receipt.loadedByteSha256 = digest(bytes);
    receipt.cacheByteSha256 = digest(readFileSync(filePath));
    receipt.cachePath = filePath;
    receipt.loadedBytesMatchCache = receipt.loadedByteSha256 === receipt.cacheByteSha256;

    const normalizedFilePath = filePath.replaceAll('\\', '/');
    const retained = retainedRasterRows.find((row) =>
    {
        return row.sha256 === receipt.loadedByteSha256
            && normalizedFilePath.endsWith('/' + row.pack + '/' + row.path);
    });

    if (!retained || !receipt.loadedBytesMatchCache || response.status !== captureConfig.successfulHttpStatus)
    {
        throw new Error(`Loaded bytes differ from recorded pinned baseline: ${assetId}`);
    }

    receipt.loadedBytesMatchRetainedBaseline = true;
    receipt.pack = retained.pack;
}

function captureProfile(classId)
{
    return classId === 'reaver'
        ? 'reaver-greatsword-pilot'
        : 'class-smash-starseer';
}

function outputPath(filename)
{
    return fileURLToPath(new URL(filename, import.meta.url));
}

const modulePath = process.env.PLAYWRIGHT_MODULE;

if (!modulePath)
{
    throw new Error('Set PLAYWRIGHT_MODULE to an existing playwright module; no dependency install required.');
}

const { chromium } = createRequire(import.meta.url)(modulePath);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const sourceHashes = readJson('../measurements/source-hashes.json');
const rasterHashes = readJson('../measurements/raster-hashes.json');

if (sourceHashes.baseline !== captureConfig.sourceBaseline || rasterHashes.release !== captureConfig.artTag)
{
    throw new Error('Unexpected retained baseline metadata');
}

verifyRetainedSources(sourceHashes, root);

const retainedRasterRows = Object.values(rasterHashes.assets).flat();

verifyRetainedRasters(retainedRasterRows, root, rasterHashes.release);
console.log(`Baseline guards passed: ${sourceHashes.files.length} owning source files, ${retainedRasterRows.length} retained raster rows`);

const server = await serve(
{
    root,
    port: captureConfig.port,
    host: captureConfig.host,
    open: false,
    quiet: true,
});
const browser = await chromium.launch(
{
    channel: process.env.BROWSER_CHANNEL || captureConfig.defaultBrowserChannel,
    headless: true,
});
const record =
{
    sourceBaseline: captureConfig.sourceBaseline,
    artTag: captureConfig.artTag,
    capturedAt: new Date().toISOString(),
    kind: 'Before-only diagnostic posed states, not a playthrough',
    browser: browser.version(),
    clockMethod: 'Production stage methods with synthetic performance.now/RAF; each sampled stage RAF queue is frozen before advancing another stage. No production code or source pixels changed.',
    captures: [],
    errors: [],
};

try
{
    for (const [width, height] of captureConfig.viewports)
    {
        for (const classId of captureConfig.classIds)
        {
            const page = await browser.newPage(
            {
                viewport: { width, height },
                reducedMotion: 'no-preference',
                deviceScaleFactor: captureConfig.deviceScaleFactor,
            });

            page.on('pageerror', (error) =>
            {
                record.errors.push(`${classId}/${width}: ${error.message}`);
                console.log('PAGE ERROR', error.message);
            });

            const url = server.url + captureConfig.verificationPath + `runtime-baseline.html?case=${classId}`;

            await page.goto(url, { waitUntil: 'load' });
            await page.waitForFunction(() =>
            {
                return window.captureReady;
            }, null,
            {
                timeout: captureConfig.captureReadyTimeoutMs,
                polling: captureConfig.captureReadyPollingMs,
            });

            const file = `runtime-${classId}-${width}-before.png`;

            await page.screenshot(
            {
                path: outputPath(file),
                fullPage: width === captureConfig.phoneWidth,
            });

            const receipts = await page.evaluate(() =>
            {
                return window.receipts;
            });

            for (const receipt of receipts)
            {
                await verifyLoadedImage(receipt, retainedRasterRows, root);
            }

            const pngBytes = readFileSync(new URL(file, import.meta.url));

            record.captures.push(
            {
                file,
                bytes: pngBytes.length,
                sha256: digest(pngBytes),
                url,
                viewport: [width, height],
                reducedMotion: false,
                effects: 'off',
                sharedDiagnosticZoom: captureConfig.sharedDiagnosticZoom,
                profile: captureProfile(classId),
                receipts,
            });

            const summaries = receipts.map((receipt) =>
            {
                const height = receipt.drawCanvas[captureConfig.drawHeightIndex];
                return `${receipt.pose}: ${height.toFixed(captureConfig.printedDecimalPlaces)}`;
            });

            console.log(file, summaries.join(' | '));
            await page.close();
        }
    }

    const [width, height] = captureConfig.viewports[0];
    const page = await browser.newPage(
    {
        viewport: { width, height },
        reducedMotion: 'no-preference',
    });

    page.on('pageerror', (error) =>
    {
        record.errors.push('game: ' + error.message);
    });

    const fullGameClassIds = process.env.CAPTURE_FULL_GAME === '0'
        ? []
        : ['reaver'];

    for (const classId of fullGameClassIds)
    {
        const url = server.url + `index.html?shot=combat&gameProfile=core&shotClass=${classId}&shotSeed=${captureConfig.fullGameShotSeed}&shotEnemyCount=1`;

        try
        {
            await page.goto(url,
            {
                waitUntil: 'domcontentloaded',
                timeout: captureConfig.fullGameNavigationTimeoutMs,
            });
            await page.waitForFunction(() =>
            {
                return document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt;
            }, null,
            {
                timeout: captureConfig.fullGameReadyTimeoutMs,
            });
            await page.waitForTimeout(captureConfig.fullGameSettleMs);

            const file = `combat-${classId}-1280-before.png`;

            await page.screenshot({ path: outputPath(file) });
            record.captures.push(
            {
                file,
                url,
                viewport: [width, height],
                kind: 'Full-game developer shot=combat forced baseline, not playthrough',
            });
            console.log(file);
        }
        catch (error)
        {
            record.errors.push(`full-game ${classId}: ${error.message}`);
            console.log('full-game limitation', classId, error.message.slice(0, captureConfig.limitedErrorLength));
        }
    }
}
finally
{
    writeFileSync(new URL('runtime-capture-record.json', import.meta.url), JSON.stringify(record, null, captureConfig.jsonIndent) + '\n');
    await browser.close();
    await new Promise((resolve) =>
    {
        server.server.close(resolve);
    });
}
