// Read-only public delivery proof for this approved card gallery only.
import { createHash } from 'node:crypto';
const base = 'https://cehinds.github.io/AshenSpire/';
const route = 'branches/Feature/CardPreview/latest/';
const expectedBytes = 11139723;
const expectedHash = 'f402742bbdf84ba368020a0992ee063546c57881f48a6e3f91c791eb60250291';
const sandbox = 'allow-scripts allow-pointer-lock allow-popups';
const deadline = Date.now() + 14 * 60_000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, method = 'GET') {
  const response = await fetch(new URL(path, base), { method, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  console.log(`${new Date().toISOString()} ${method} ${new URL(path, base)} HTTP ${response.status}`);
  if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
let ready = null;
for (let attempt = 1; Date.now() < deadline; attempt++) {
  try {
    console.log(`Public card preview attempt ${attempt}`);
    const index = await (await request('')).text();
    const sections = index.match(/<section\b[^>]*>[\s\S]*?<\/section>/gi) || [];
    const section = sections.find(row => row.includes(`href="${route}"`));
    const source = section?.match(/\/commit\/([a-f0-9]{40})\b/i)?.[1];
    if (!source) throw new Error('Public index has no card preview source SHA');
    console.log(`Actual public card preview source SHA: ${source}`);
    const wrapper = await (await request(route)).text();
    const frame = wrapper.match(/<iframe\b[^>]*>/i)?.[0];
    if (!frame?.includes(`sandbox="${sandbox}"`) || !wrapper.includes('<script src="preview.js"></script>')) throw new Error('Trusted sandbox wrapper is missing');
    const loader = await (await request(route + 'preview.js')).text();
    if (!loader.includes("fetch('build.txt'") || !loader.includes('frame.srcdoc =')) throw new Error('Trusted build.txt loader is missing');
    const head = await request(route + 'build.txt', 'HEAD');
    const bytes = Number(head.headers.get('content-length'));
    const type = head.headers.get('content-type') || '';
    console.log(`Public payload HEAD: bytes=${bytes}, content-type=${type}`);
    if (bytes !== expectedBytes || !/^text\/plain\b/i.test(type)) throw new Error('Approved plaintext payload is not available yet');
    ready = { source };
    break;
  } catch (error) {
    console.log(`Not ready: ${error.message}`);
    if (Date.now() + 15_000 >= deadline) break;
    await pause(15_000);
  }
}
if (!ready) throw new Error('Card preview public delivery did not become ready within 14 minutes');
// Fetch the approved payload exactly once after index/wrapper/loader/HEAD pass.
const response = await request(route + 'build.txt');
const bytes = Buffer.from(await response.arrayBuffer());
const actualHash = createHash('sha256').update(bytes).digest('hex');
console.log(`Public payload GET: bytes=${bytes.length}, SHA-256=${actualHash}`);
if (bytes.length !== expectedBytes || actualHash !== expectedHash) throw new Error('Public payload differs from the approved card gallery');
console.log(`PASS: own public card preview HTTP/index/sandbox/loader/plaintext/length/SHA-256 verified; actual public source SHA=${ready.source}`);
