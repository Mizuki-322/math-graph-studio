const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { net, protocol } = require('electron');

const scheme = 'mathgraph';
const origin = `${scheme}://app`;
const dist = path.resolve(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

function pageUrl(page) { return `${origin}/${page}`; }

function registerStaticProtocol() {
  protocol.handle(scheme, request => {
    const url = new URL(request.url);
    if (url.protocol !== `${scheme}:` || url.host !== 'app' || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return new Response('Not found', { status: 404 });
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dist, relative);
    const withinDist = path.relative(dist, file);
    if (!withinDist || withinDist.startsWith('..') || path.isAbsolute(withinDist)) {
      return new Response('Invalid path', { status: 400 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

module.exports = { origin, pageUrl, registerStaticProtocol };
