// Local-only guard.
//
// FotoApp serves your whole photo library over HTTP on port 3000 and has
// endpoints that move files to the trash. That server must only ever answer
// the app itself:
//   1. index.js listens on 127.0.0.1, so other devices on the network
//      (same Wi-Fi, hotel network, ...) cannot connect at all.
//   2. The Host header must be localhost/127.0.0.1 on our port. This blocks
//      DNS rebinding, where a website points its own domain at 127.0.0.1 to
//      read the API from the browser.
//   3. If the browser sends an Origin header (cross-site fetch/form POST and
//      every WebSocket handshake), it must be our own origin. This blocks any
//      website you visit from triggering actions or opening the WebSocket.

function allowedHosts(port) {
  return new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
}

function isLocalRequest(headers, port) {
  const hosts = allowedHosts(port);
  const host = String((headers && headers.host) || '').toLowerCase();
  if (!hosts.has(host)) return false;
  const origin = headers && headers.origin;
  if (origin === undefined || origin === '') return true;
  const o = String(origin).toLowerCase();
  if (!o.startsWith('http://')) return false;   // includes "null" (file://, sandboxed frames)
  return hosts.has(o.slice('http://'.length));
}

function expressGuard(port) {
  return function localOnly(req, res, next) {
    if (isLocalRequest(req.headers, port)) return next();
    res.status(403).type('text/plain').send('Forbidden: FotoApp only accepts requests from this computer.');
  };
}

module.exports = { isLocalRequest, expressGuard };
