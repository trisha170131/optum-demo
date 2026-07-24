// Minimal hand-written HTTP router using only Node's built-in `http` module. There is no
// Express here on purpose — this environment has no npm registry access, so no framework
// dependency can be installed. Production engineering should swap this for Express/Fastify once
// normal tooling is available (see HANDOFF.md); every route handler below has the signature
// `(req, res, ctx) => void|Promise<void>` so that swap is mostly mechanical.
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    const paramNames = [];
    const pattern = new RegExp(
      '^' +
        path
          .split('/')
          .map((seg) => {
            if (seg.startsWith(':')) {
              paramNames.push(seg.slice(1));
              return '([^/]+)';
            }
            return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('/') +
        '/?$',
    );
    routes.push({ method, pattern, paramNames, handler });
  }

  async function dispatch(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(url.searchParams);
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;
      const params = Object.fromEntries(route.paramNames.map((name, i) => [name, decodeURIComponent(match[i + 1])]));
      try {
        await route.handler(req, res, { params, query, pathname: url.pathname });
      } catch (err) {
        console.error(`[error] ${req.method} ${url.pathname}:`, err);
        if (!res.headersSent) sendJson(res, err.statusCode ?? 500, { error: err.message });
      }
      return true;
    }
    return false;
  }

  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    dispatch,
  };
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

export function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

export async function serveStatic(res, rootDir, requestPath) {
  const safePath = requestPath.replace(/\.\.+/g, '');
  const filePath = join(rootDir, safePath === '/' ? '/index.html' : safePath);
  try {
    const data = await readFile(filePath);
    const type = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}
