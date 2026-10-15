// Isolated delivery evidence. HEAD requests never download game or installer bytes.
import { writeFileSync } from 'node:fs';

const base = 'https://cehinds.github.io/AshenSpire';
const report = { checkedAt: new Date().toISOString(), sourceCommit: process.env.GITHUB_SHA || null,
  requests: [], channels: [], failures: [] };
const textLimit = 256 * 1024;
async function request(url, { text = false } = {}) {
  const row = { url, method: text ? 'GET' : 'HEAD' };
  report.requests.push(row);
  const response = await fetch(url, { method: row.method, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  row.status = response.status;
  row.contentType = response.headers.get('content-type');
  row.contentLength = response.headers.get('content-length');
  if (response.status !== 200) throw Error(`${row.method} ${url}: HTTP ${response.status}`);
  if (!text) return null;
  if (Number(row.contentLength) > textLimit) throw Error(`${url}: small-text limit exceeded`);
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > textLimit) throw Error(`${url}: small-text limit exceeded`);
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  row.textBytes = bytes;
  return Buffer.concat(chunks).toString('utf8');
}
async function capture(task) {
  try { await task(); } catch (error) { report.failures.push(error.message); }
}

await Promise.all(['dev', 'test', 'release', 'main'].map(channel => capture(async () => {
  const route = `${base}/${channel}`;
  const requests = await Promise.allSettled([
    request(`${route}/`, { text: true }), request(`${route}/latest/build.svg`, { text: true }),
    request(`${route}/latest/build.json`, { text: true }),
    request(`${route}/latest/`), request(`${route}/latest/download/AshenSpire.html`),
  ]);
  const errors = requests.filter(result => result.status === 'rejected').map(result => result.reason.message);
  if (errors.length) throw Error(errors.join('; '));
  const [history, badge, json] = requests.map(result => result.value);
  const metadata = JSON.parse(json);
  // These are the fields emitted by pages-site.mjs, not an inferred source SHA.
  if (metadata.branch !== channel || !Number.isSafeInteger(metadata.ordinal) || metadata.ordinal < 0
    || !/^[a-f0-9]{40}$/.test(metadata.commit || '')
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(metadata.version || '')
    || !/^[a-f0-9]{10}$/.test(metadata.digest || '')
    || !['full', 'light'].includes(metadata.edition) || !['pack', 'single'].includes(metadata.shape)
    || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.built || '')
    || !Number.isFinite(Date.parse(metadata.built))
    || new Date(metadata.built).toISOString().slice(0, 10) !== metadata.built) throw Error(`${channel}: invalid published identity`);
  const version = `${metadata.version}.${metadata.ordinal}`;
  if (!badge.includes(version)) throw Error(`${channel}: badge disagrees with build.json (${version})`);
  if (!history.includes(`${metadata.ordinal}/`)) throw Error(`${channel}: history lacks latest build ${metadata.ordinal}`);
  await request(`${route}/${metadata.ordinal}/`);
  report.channels.push({ channel, version, commit: metadata.commit, digest: metadata.digest,
    edition: metadata.edition, shape: metadata.shape, built: metadata.built,
    exactPlayUrl: `${route}/${metadata.ordinal}/` });
})));
await Promise.all([
  `${base}/`, `${base}/workbench/`, `${base}/release/1060/`,
  'https://github.com/cehinds/AshenSpire/releases/download/installer-release/AshenSpire-Setup.exe',
  'https://github.com/cehinds/AshenSpire/releases/tag/installer-release',
  'https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml',
].map(url => capture(() => request(url))));

report.completedAt = new Date().toISOString();
writeFileSync('readme-public-route-proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ channels: report.channels, requests: report.requests.length, failures: report.failures }, null, 2));
if (report.failures.length) process.exitCode = 1;
