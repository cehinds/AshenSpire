// Verify public delivery only. Never download or execute a feature game's HTML.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_SANDBOX = 'allow-scripts allow-pointer-lock allow-popups';
const safePath = (value) => typeof value === 'string' && /^[A-Za-z0-9._/-]+$/.test(value)
  && value.split('/').every((part) => part && part !== '.' && part !== '..');

export async function checkFeaturePages({ baseUrl, targets, fetchImpl = fetch, attempts = 5, delay = (ms) => new Promise((done) => setTimeout(done, ms)) }) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('Pages URL must use HTTPS');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  if (!Array.isArray(targets)) throw new Error('Preview targets must be an array');
  for (const target of targets) {
    if (!safePath(target.dir) || !/^[a-f0-9]{7,40}$/.test(target.sha)) throw new Error('Invalid preview path or source SHA');
  }
  if (!targets.length) return 0;
  const request = async (path, method = 'GET') => {
    const response = await fetchImpl(new URL(path, base), { method, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const index = await (await request('')).text();
      const cards = index.match(/<section\b[^>]*>[\s\S]*?<\/section>/g) || [];
      for (const { dir, sha } of targets) {
        const route = `branches/${dir}/latest/`;
        const card = cards.find((row) => row.includes(`href="${route}"`));
        if (!card || !card.includes(`/commit/${sha}`) || !card.includes(sha.slice(0, 10))) throw new Error(`${dir}: stale or missing source SHA in public index`);
        const wrapper = await (await request(route)).text();
        const frame = wrapper.match(/<iframe\b[^>]*>/i)?.[0];
        if (!frame || !frame.includes(`sandbox="${EXPECTED_SANDBOX}"`) || !wrapper.includes('<script src="preview.js"></script>')) throw new Error(`${dir}: missing trusted sandbox wrapper`);
        const script = await (await request(`${route}preview.js`)).text();
        if (!script.includes("fetch('build.txt'") || !script.includes('frame.srcdoc =')) throw new Error(`${dir}: missing build.txt preview loader`);
        const build = await request(`${route}build.txt`, 'HEAD');
        if (!(Number(build.headers.get('content-length')) > 0) || !/^text\/plain\b/i.test(build.headers.get('content-type') || '')) throw new Error(`${dir}: build.txt is empty or not served as plain text`);
      }
      return targets.length;
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(3_000);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const targets = JSON.parse(process.env.PREVIEW_TARGETS || '[]');
    const count = await checkFeaturePages({ baseUrl: process.env.PAGES_URL, targets });
    console.log(`Public Pages HTTP verification passed for ${count} feature preview(s).`);
  } catch (error) {
    console.error(`Public Pages HTTP verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
