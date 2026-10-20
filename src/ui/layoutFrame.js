// One animation-frame pass for layout work that must read the DOM and then
// write it. A job is `read()` returning the function that writes (or nothing);
// every job's read runs before any job's write, so jobs queued by different
// components in the same frame cost one forced layout between them, not one
// per component. A job queued again under the same key replaces the earlier one.
const jobs = new Map();
let frame = 0;

function run() {
  frame = 0;
  const queued = [...jobs.values()];
  jobs.clear();
  const writes = [];
  for (const read of queued) {
    try { const write = read(); if (typeof write === 'function') writes.push(write); } catch (error) { console.error(error); }
  }
  for (const write of writes) {
    try { write(); } catch (error) { console.error(error); }
  }
}

export function scheduleLayoutPass(key, read) {
  jobs.set(key, read);
  if (!frame) frame = requestAnimationFrame(run);
}

export function cancelLayoutPass(key) { jobs.delete(key); }
