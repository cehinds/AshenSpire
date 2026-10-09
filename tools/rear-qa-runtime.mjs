// Browser-test instrumentation only. The on-disk package stays unchanged;
// exposing its existing module exports lets tests exercise the compiled stage.
export async function openCombatQa(page, base, shot) {
  const url = new URL(base);
  if (shot) url.searchParams.set('shot', shot);
  const packaged = url.pathname.endsWith('.html');
  if (packaged) {
    await page.route(request => request.origin === url.origin && request.pathname === url.pathname, async route => {
      const response = await route.fetch();
      const html = await response.text();
      const entry = '  require("src/main.js");';
      if (html.split(entry).length !== 2) throw new Error('The package runtime entry changed; update the QA adapter');
      const expose = `  globalThis.__combatQaRuntime = {
        stageFor: require("src/ui/services/PoseAnimator.js").stageFor,
        createStage: require("src/ui/alternativeCardStage.js").createAlternativeCardStage,
        catalog: require("src/content/alternativeCardAnimations.js").alternativeCardAnimations
      };\n`;
      await route.fulfill({ response, body: html.replace(entry, expose + entry) });
    });
  }
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60000 });
  return { url: url.href, packaged, instrumented: packaged };
}
