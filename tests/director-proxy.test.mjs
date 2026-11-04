import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const source = fs.readFileSync('src/app/api/proxy/[...path]/route.ts', 'utf8');
const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(upstream, token = 'test-session') {
  const calls = [];
  const context = {
    exports: {}, process: { env: { API_URL: 'http://backend.test' } },
    require(name) {
      if (name === 'next/server') return { NextResponse };
      if (name === 'next/headers') return { cookies: async () => ({ get: () => token ? { value: token } : undefined }) };
      if (name === '@/lib/auth/session') return { SESSION_COOKIE: 'ezgen_session' };
      throw new Error(`Unexpected module ${name}`);
    },
    fetch: async (url, options) => { calls.push({ url, ...options }); return upstream(); },
    AbortSignal, Uint8Array, URL, Headers,
  };
  vm.runInNewContext(emitted, context);
  const invoke = (method, { body, headers = {}, path = ['director', 'projects', 'project'], query = '', serverOrigin = 'http://studio.test' } = {}) => {
    const handler = context.exports[method];
    assert.equal(typeof handler, 'function', `${method} must be exported for Next routing`);
    const req = new NextRequest(`${serverOrigin}/api/proxy/${path.join('/')}${query}`, { method, headers, body });
    return handler(req, { params: Promise.resolve({ path }) });
  };
  return { invoke, calls };
}

test('PATCH reaches backend with revision payload and server session authorization', async () => {
  const fixture = harness(() => Response.json({ data: { revision: 3 } }));
  const body = JSON.stringify({ revision: 2, name: 'เรื่องใหม่' });
  const result = await fixture.invoke('PATCH', { body, headers: { origin: 'http://studio.test', authorization: 'Bearer browser-value' } });
  assert.equal(result.status, 200);
  assert.equal(fixture.calls[0].method, 'PATCH');
  assert.equal(fixture.calls[0].headers.Authorization, 'Bearer test-session');
  assert.equal(fixture.calls[0].body, body);
});

test('conditional GET forwards validator and preserves 304 ETag without a body', async () => {
  const etag = 'W/"3-9"';
  const fixture = harness(() => new Response(null, { status: 304, headers: { ETag: etag } }));
  const result = await fixture.invoke('GET', { headers: { 'If-None-Match': etag } });
  assert.equal(new Headers(fixture.calls[0].headers).get('if-none-match'), etag);
  assert.equal(result.status, 304);
  assert.equal(result.headers.get('etag'), etag);
  assert.equal(await result.text(), '');
});

test('successful reads preserve ETag and rate limits preserve Retry-After', async () => {
  for (const [status, responseHeaders] of [[200, { ETag: 'W/"4-10"' }], [429, { 'Retry-After': '60' }]]) {
    const fixture = harness(() => Response.json({ code: status === 429 ? 'RATE_LIMITED' : undefined, requestId: 'request-1' }, { status, headers: responseHeaders }));
    const result = await fixture.invoke('GET');
    assert.equal(result.status, status);
    for (const [name, value] of Object.entries(responseHeaders)) assert.equal(result.headers.get(name), value);
    assert.equal((await result.json()).requestId, 'request-1');
  }
});

test('DELETE preserves revision in body or query and no-content responses stay empty', async () => {
  const fixture = harness(() => new Response(null, { status: 204 }));
  const body = JSON.stringify({ revision: 5 });
  let result = await fixture.invoke('DELETE', { body, headers: { 'content-type': 'application/json' } });
  assert.equal(fixture.calls[0].body, body);
  assert.equal(result.status, 204);
  assert.equal(await result.text(), '');
  result = await fixture.invoke('DELETE', { query: '?revision=6' });
  assert.equal(new URL(fixture.calls[1].url).searchParams.get('revision'), '6');
  assert.equal(result.status, 204);
});

test('session and same-origin write guards block requests before backend calls', async () => {
  const noSession = harness(() => Response.json({}), null);
  assert.equal((await noSession.invoke('GET')).status, 401);
  assert.equal(noSession.calls.length, 0);
  const fixture = harness(() => Response.json({}));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fixture.invoke(method, { body: '{}', headers: { origin: 'http://evil.test' } })).status, 403);
  }
  assert.equal(fixture.calls.length, 0);
});

test('existing editor upload rejects unsupported and oversized bodies before forwarding', async () => {
  const fixture = harness(() => Response.json({}));
  const path = ['video-editor', 'projects', 'project', 'assets'];
  assert.equal((await fixture.invoke('POST', { path, body: '{}' })).status, 422);
  assert.equal((await fixture.invoke('POST', { path, body: 'oversized', headers: { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(56 * 1024 * 1024) } })).status, 413);
  assert.equal(fixture.calls.length, 0);
});

test('same-origin writes compare actual Host instead of Next normalized loopback URL', async () => {
  const fixture = harness(() => Response.json({ data: { revision: 3 } }));
  const serverOrigin = 'http://127.0.0.1:13139';
  assert.equal(new NextRequest(serverOrigin).nextUrl.origin, 'http://localhost:13139');
  const result = await fixture.invoke('PATCH', { serverOrigin, body: '{}', headers: { host: '127.0.0.1:13139', origin: serverOrigin } });
  assert.equal(result.status, 200);
  const ipv6 = await fixture.invoke('PATCH', { serverOrigin: 'http://[::1]:13139', body: '{}', headers: { host: '[::1]:13139', origin: 'http://[::1]:13139' } });
  assert.equal(ipv6.status, 200);
});

test('actual Host origin guard rejects aliases, protocol and port mismatches, spoofed forwarded hosts and malformed Host', async () => {
  const fixture = harness(() => Response.json({}));
  for (const origin of ['http://localhost:13139', 'https://127.0.0.1:13139', 'http://127.0.0.1:13140', 'http://evil.test']) {
    const result = await fixture.invoke('PATCH', { serverOrigin: 'http://127.0.0.1:13139', body: '{}', headers: { host: '127.0.0.1:13139', origin, 'x-forwarded-host': new URL(origin).host } });
    assert.equal(result.status, 403, origin);
  }
  for (const host of ['http://studio.test', 'studio.test/path', 'user@studio.test', 'studio.test?query', 'studio.test#hash', 'studio.test,evil.test', 'studio.test invalid']) {
    const result = await fixture.invoke('PATCH', { body: '{}', headers: { host, origin: 'http://studio.test' } });
    assert.equal(result.status, 403, host);
  }
  assert.equal(fixture.calls.length, 0);
});
