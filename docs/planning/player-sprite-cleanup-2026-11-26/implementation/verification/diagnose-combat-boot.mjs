import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { serve } from '../../../../../tools/serve.mjs';

const config =
{
    playwrightModule: process.env.PLAYWRIGHT_MODULE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.js',
    port: 8339,
    viewport: { width: 1280, height: 800 },
    navigationTimeoutMs: 60000,
    inspectionIntervalsMs: [0, 1000],
};
const { chromium } = createRequire(import.meta.url)(config.playwrightModule);
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const server = await serve({ root, port: config.port, host: '127.0.0.1', open: false, quiet: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: config.viewport, reducedMotion: 'no-preference' });
const record =
{
    observedAt: new Date().toISOString(),
    console: [],
    pageErrors: [],
    failedRequests: [],
    responses: [],
    snapshots: [],
};

page.on('console', (message) =>
{
    if (['warning', 'error'].includes(message.type()))
    {
        record.console.push({ type: message.type(), text: message.text() });
    }
});
page.on('pageerror', (error) => record.pageErrors.push(error.stack));
page.on('requestfailed', (request) => record.failedRequests.push({ url: request.url(), failure: request.failure() }));
page.on('response', (response) =>
{
    if (response.status() >= 400)
    {
        record.responses.push({ status: response.status(), url: response.url() });
    }
});

try
{
    const url = server.url + 'index.html?shot=combat&gameProfile=core&shotClass=starseer&shotSeed=SPRITEAUDIT20261126&shotEnemyCount=1';

    record.url = url;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.navigationTimeoutMs });

    for (const waitMs of config.inspectionIntervalsMs)
    {
        await page.waitForTimeout(waitMs);

        const snapshot = await page.evaluate(() =>
        {
            return {
                readyState: document.readyState,
                title: document.title,
                appText: document.querySelector('#app')?.innerText.slice(0, 1800),
                combatants: [...document.querySelectorAll('.combatant')].map((element) =>
                {
                    const stage = element.querySelector('.pose-stage');
                    const controller = stage?.__poseStage;
                    const acceptedHit = controller?.currentArt && controller.play('hit', 6000);

                    return { classes: element.className, eid: element.dataset.eid, stage: stage?.className, stageData: stage && { ...stage.dataset }, attachedController: !!controller, art: !!controller?.currentArt, acceptedHit, image: controller?.currentArt?.image.currentSrc };
                }),
                debugKeys: Object.keys(window).filter((key) => key.startsWith('__')).slice(0, 55),
                bodyClasses: document.body.className,
                customization: window.__combatRunForShot?.customization,
                datasets: { ...document.documentElement.dataset },
            };
        });

        record.snapshots.push({ waitMs, snapshot });
        console.log(JSON.stringify(record.snapshots.at(-1)));
    }

    console.log(JSON.stringify({ pageErrors: record.pageErrors, errors: record.console, failed: record.failedRequests, badResponses: record.responses }));
}
finally
{
    writeFileSync(new URL('boot-diagnosis.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
    await browser.close();
    await new Promise((resolve) => server.server.close(resolve));
}

