// Verify public delivery. Primary pages are hashed as bytes; no game HTML is executed.
import { resolve, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EXPECTED_SANDBOX = 'allow-scripts allow-pointer-lock allow-popups';
const safePath = (value) => typeof value === 'string' && /^[A-Za-z0-9._/-]+$/.test(value)
  && value.split('/').every((part) => part && part !== '.' && part !== '..');

export async function checkFeaturePages({ baseUrl, targets, primaryTargets, fetchImpl = fetch, attempts = 5, delay = (ms) => new Promise((done) => setTimeout(done, ms)), report = console.log }) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('Pages URL must use HTTPS');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  if (!Array.isArray(targets)) throw new Error('Preview targets must be an array');
  for (const target of targets) {
    if (!safePath(target.dir) || !/^[a-f0-9]{7,40}$/.test(target.sha)) throw new Error('Invalid preview path or source SHA');
  }
  if (primaryTargets !== undefined) await checkPrimaryChannels({ baseUrl, targets: primaryTargets, fetchImpl, attempts, delay, report });
  if (!targets.length) return 0;
  const request = async (path, method = 'GET') => {
    const response = await fetchImpl(new URL(path, base), { method, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const indexResponse = await request('');
      const index = await indexResponse.text();
      const cards = index.match(/<section\b[^>]*>[\s\S]*?<\/section>/g) || [];
      for (const { dir, sha } of targets) {
        const route = `branches/${dir}/latest/`;
        const card = cards.find((row) => row.includes(`href="${route}"`));
        if (!card || !card.includes(`/commit/${sha}`) || !card.includes(sha.slice(0, 10))) throw new Error(`${dir}: stale or missing source SHA in public index; expected ${sha}, observed ${observedCommit(card)}; ${cacheContext(indexResponse)}`);
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

const PRIMARY_CHANNELS = ['dev', 'test', 'release', 'main'];
const PRIMARY_FIELDS = ['branch', 'commit', 'ordinal', 'version', 'digest', 'stamp', 'pageBytes', 'pageSha256'];
const SHA = /^[a-f0-9]{40}$/, HASH = /^[a-f0-9]{64}$/;
const safeDigest = value => typeof value === 'string' && /^[0-9A-Za-z._-]{0,128}$/.test(value);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const observedCommit = (card) => card?.match(/\/commit\/([a-f0-9]{40})/)?.[1] || 'missing';
function cacheContext(response) {
  return [['Age', 'age'], ['ETag', 'etag'], ['Last-Modified', 'last-modified']].map(([label, header]) =>
    `${label}=${(response.headers.get(header) || 'missing').replace(/[\r\n]/g, ' ').slice(0, 120)}`).join('; ');
}
function validatePrimaryTargets(targets) {
  if (!Array.isArray(targets)) throw new Error('Invalid primary targets');
  const branches = new Set();
  for (const row of targets) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).some(key => !PRIMARY_FIELDS.includes(key))
      || !PRIMARY_CHANNELS.includes(row.branch) || branches.has(row.branch)
      || !SHA.test(row.commit) || !Number.isSafeInteger(row.ordinal) || row.ordinal < 0
      || !(row.version === null || typeof row.version === 'string' && /^[0-9][0-9A-Za-z.+-]{0,63}$/.test(row.version))
      || !safeDigest(row.digest)
      || row.stamp !== (row.version ? `BUILD ${row.version}.${row.ordinal} · src ${row.digest}` : `BUILD ·${row.ordinal} · src ${row.digest}`)
      || !Number.isSafeInteger(row.pageBytes) || row.pageBytes <= 0 || !HASH.test(row.pageSha256)) throw new Error('Invalid primary target');
    branches.add(row.branch);
  }
  if (!branches.has('test')) throw new Error('Missing required Test primary target');
}

// Freeze the exact assembled aliases, not refs that may move while Pages uploads.
export function capturePrimaryChannels(siteDir) {
  const targets = [];
  for (const branch of PRIMARY_CHANNELS) {
    const dir = join(siteDir, branch, 'latest'), metadataFile = join(dir, 'build.json');
    if (!existsSync(metadataFile)) continue;
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
    const page = readFileSync(join(dir, 'index.html'));
    const row = Object.fromEntries(PRIMARY_FIELDS.slice(0, 6).map(key => [key, metadata[key]]));
    if (row.branch !== branch) throw new Error(`${branch}: assembled metadata names another channel`);
    row.pageBytes = page.length; row.pageSha256 = sha256(page);
    if (metadata.pageSha256 !== undefined && metadata.pageSha256 !== row.pageSha256
      || metadata.pageBytes !== undefined && metadata.pageBytes !== page.length
      || metadata.bytes != null && metadata.bytes !== page.length) throw new Error(`${branch}: assembled page differs from its metadata`);
    targets.push(row);
  }
  validatePrimaryTargets(targets);
  return targets;
}

export async function checkPrimaryChannels({ baseUrl, targets, fetchImpl = fetch, attempts = 5,
  delay = (ms) => new Promise(done => setTimeout(done, ms)), report = console.log }) {
  validatePrimaryTargets(targets);
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('Pages URL must use HTTPS');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const request = async (path) => {
    const response = await fetchImpl(new URL(path, base), { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}; ${cacheContext(response)}`);
    return response;
  };
  // Same bounded eventual-consistency policy as feature previews; every retry re-reads the index.
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const indexResponse = await request(''), index = await indexResponse.text();
      const cards = index.match(/<section\b[^>]*>[\s\S]*?<\/section>/g) || [];
      const verified = [];
      for (const expected of targets) {
        const { branch, commit, ordinal, stamp } = expected;
        const card = cards.find(row => row.includes(`<h3>${branch}</h3>`));
        if (!card?.includes(`href="${branch}/${ordinal}/"`) || !card.includes(`/commit/${commit}`)
          || !card.includes(`<p class="stamp">${stamp}</p>`)) throw new Error(`${branch}: stale or missing public index card; expected ${commit} ${stamp}, observed ${observedCommit(card)}; ${cacheContext(indexResponse)}`);
        const route = `${branch}/latest/`, metadataResponse = await request(`${route}build.json`);
        let actual;
        try { actual = JSON.parse(await metadataResponse.text()); } catch { throw new Error(`${branch}: invalid public metadata JSON; ${cacheContext(metadataResponse)}`); }
        if (!actual || PRIMARY_FIELDS.slice(0, 6).some(key => actual[key] !== expected[key])
          || actual.pageSha256 !== undefined && actual.pageSha256 !== expected.pageSha256
          || actual.pageBytes !== undefined && actual.pageBytes !== expected.pageBytes
          || actual.bytes != null && actual.bytes !== expected.pageBytes) throw new Error(`${branch}: stale public metadata; expected ${commit} ${stamp}; observed ${SHA.test(actual?.commit) ? actual.commit : 'invalid'} digest ${safeDigest(actual?.digest) ? actual.digest || '(empty)' : 'invalid'}; ${cacheContext(metadataResponse)}`);
        const pageResponse = await request(`${route}index.html`), hash = createHash('sha256');
        let bytes = 0;
        if (!pageResponse.body) throw new Error(`${branch}: empty public page; ${cacheContext(pageResponse)}`);
        for await (const chunk of pageResponse.body) {
          bytes += chunk.length;
          if (bytes > expected.pageBytes) throw new Error(`${branch}: public page exceeds expected ${expected.pageBytes} bytes; ${cacheContext(pageResponse)}`);
          hash.update(chunk);
        }
        const digest = hash.digest('hex');
        if (bytes !== expected.pageBytes || digest !== expected.pageSha256) throw new Error(`${branch}: public page SHA256 differs; expected ${expected.pageSha256} (${expected.pageBytes} bytes), observed ${digest} (${bytes} bytes); ${cacheContext(pageResponse)}`);
        verified.push(`Public Pages primary verified: ${branch} ${stamp}; commit ${commit}; page sha256 ${digest} (${bytes} bytes).`);
      }
      for (const message of verified) report(message);
      return targets.length;
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(3_000);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === '--capture-primary') {
      if (process.argv.length !== 4) throw new Error('Usage: --capture-primary <assembled-site>');
      console.log(JSON.stringify(capturePrimaryChannels(resolve(process.argv[3]))));
    } else {
      const targets = JSON.parse(process.env.PREVIEW_TARGETS || '[]');
      const primaryTargets = process.env.PRIMARY_TARGETS === undefined ? undefined : JSON.parse(process.env.PRIMARY_TARGETS);
      const count = await checkFeaturePages({ baseUrl: process.env.PAGES_URL, targets, primaryTargets });
      console.log(`Public Pages HTTP verification passed for ${count} feature preview(s).`);
    }
  } catch (error) {
    console.error(`Public Pages HTTP verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
