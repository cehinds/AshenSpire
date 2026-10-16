// Read-only delivery proof. An older public gallery must never satisfy a new revision.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const base = 'https://cehinds.github.io/AshenSpire/';
const route = 'branches/Feature/CardPreview/latest/';
const expectedBytes = 11139814;
const expectedHash = '04e17eaf2cf1ebb3d393d2aa0e26a62f3fe0873f0a3f0e8e3df862debfb28d5a';
const sandbox = 'allow-scripts allow-pointer-lock allow-popups';
export async function checkPublicPage({ expectedSource = process.env.GITHUB_SHA, fetchImpl = fetch,
  now = Date.now, delay = ms => new Promise(done => setTimeout(done, ms)), log = console.log,
  timeoutMs = 44 * 60_000 } = {}) {
  if (!/^[a-f0-9]{40}$/.test(expectedSource || '')) throw new Error('GITHUB_SHA must identify the revision being published');
  const deadline = now() + timeoutMs;
  let lastPayloadGet = -Infinity, actualSource = null, actualHash = null;
  async function request(path, method = 'GET') {
    const response = await fetchImpl(new URL(path, base), { method, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    log(`${new Date(now()).toISOString()} ${method} ${new URL(path, base)} HTTP ${response.status}`);
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  }
  log(`Waiting for public card preview source ${expectedSource}; approved bytes=${expectedBytes}, SHA-256=${expectedHash}`);
  for (let attempt = 1; now() < deadline; attempt++) {
    try {
      log(`Public card preview attempt ${attempt}`);
      const index = await (await request('')).text();
      const sections = index.match(/<section\b[^>]*>[\s\S]*?<\/section>/gi) || [];
      const section = sections.find(row => row.includes(`href="${route}"`));
      actualSource = section?.match(/\/commit\/([a-f0-9]{40})\b/i)?.[1] || null;
      log(`Actual public card preview source SHA: ${actualSource || 'UNLISTED'}; expected ${expectedSource}`);
      if (actualSource !== expectedSource) throw new Error('Waiting for this revision in the public index; older gallery is not accepted');
      const wrapper = await (await request(route)).text();
      const frame = wrapper.match(/<iframe\b[^>]*>/i)?.[0];
      if (!frame?.includes(`sandbox="${sandbox}"`) || !wrapper.includes('<script src="preview.js"></script>')) throw new Error('Trusted sandbox wrapper is missing');
      const loader = await (await request(route + 'preview.js')).text();
      if (!loader.includes("fetch('build.txt'") || !loader.includes('frame.srcdoc =')) throw new Error('Trusted build.txt loader is missing');
      const head = await request(route + 'build.txt', 'HEAD');
      const size = Number(head.headers.get('content-length')), type = head.headers.get('content-type') || '';
      log(`Public payload HEAD: bytes=${size}, content-type=${type}, content-encoding=${head.headers.get('content-encoding') || 'identity'}`);
      if (!(size > 0) || !/^text\/plain\b/i.test(type)) throw new Error('Plaintext payload is not available yet');
      if (now() - lastPayloadGet < 60_000) throw new Error('CDN payload retry is limited to one GET per minute');
      lastPayloadGet = now();
      const response = await request(route + 'build.txt');
      const bytes = Buffer.from(await response.arrayBuffer());
      actualHash = createHash('sha256').update(bytes).digest('hex');
      log(`Public payload GET: bytes=${bytes.length}, SHA-256=${actualHash}`);
      if (bytes.length !== expectedBytes || actualHash !== expectedHash) throw new Error('Waiting for approved bytes to reach the CDN; stale payload is not accepted');
      log(`PASS: current public source ${actualSource}; HTTP/sandbox/loader/plaintext/decoded length/SHA-256 verified`);
      return { source: actualSource, bytes: bytes.length, sha256: actualHash };
    } catch (error) {
      log(`Not ready: ${error.message}; ${Math.max(0, Math.ceil((deadline - now()) / 1000))}s remain`);
      if (now() + 15_000 >= deadline) break;
      await delay(15_000);
    }
  }
  throw new Error(`Public preview did not match this revision within 44 minutes; source=${actualSource}, payload SHA-256=${actualHash}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkPublicPage();
