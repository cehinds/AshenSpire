// workbench/lib/sse.mjs — a tiny Server-Sent Events hub.
//
//   const hub = createSseHub();
//   hub.attach(req, res);            // inside a GET handler
//   hub.send('reload', { files });   // to every connected page
//   hub.close();                     // on shutdown
//
// A comment heartbeat every `heartbeatMs` keeps idle connections (and the
// proxies some browsers put in front of them) from timing out.
export function createSseHub({ heartbeatMs = 20000 } = {}) {
  const clients = new Set();
  const timer = setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, heartbeatMs);
  timer.unref?.();
  return {
    get size() { return clients.size; },
    attach(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
      res.write('retry: 2000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
    },
    send(event, data) {
      const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) res.write(frame);
    },
    close() { clearInterval(timer); for (const res of clients) res.end(); clients.clear(); },
  };
}
