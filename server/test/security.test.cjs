const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const origin = 'https://playlist-port.example';
const secret = 'audit-test-only-session-secret-over-32-characters';
Object.assign(process.env, {
  SPOTIFY_CLIENT_ID: 'test-client-id', SPOTIFY_CLIENT_SECRET: 'test-client-secret',
  SPOTIFY_REDIRECT_URI: `${origin}/api/auth/callback`,
  CLIENT_ORIGIN: origin, SESSION_SECRET: secret
});
const app = require('../../app.cjs');
const nativeFetch = global.fetch;

async function fixture(t) {
  let exchanges = 0;
  global.fetch = async (url, options) => {
    if (String(url) === 'https://accounts.spotify.com/api/token') {
      exchanges += 1;
      return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600 });
    }
    if (String(url) === 'https://api.spotify.com/v1/me') {
      assert.equal(options.headers.Authorization, 'Bearer fixture-access');
      return Response.json({ id: 'fixture-user', display_name: 'Fixture listener' });
    }
    throw new Error('Unexpected outbound request in security test.');
  };
  t.after(() => { global.fetch = nativeFetch; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return { call: (route, options = {}) => nativeFetch(`${base}${route}`, { redirect: 'manual', ...options }), exchanges: () => exchanges };
}

function seal(slot, values, expiresAt) {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(slot));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ values, expiresAt })), cipher.final()]);
  return `playlist_port.${slot}=${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')}`;
}

test('production entry protects documents, API responses, and errors with browser security headers', async (t) => {
  const { call } = await fixture(t);
  for (const route of ['/', '/api/health', '/api/not-a-route']) {
    const response = await call(route);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /(?:^|;\s*)script-src 'self'(?:;|$)/);
    assert.match(csp, /(?:^|;\s*)frame-ancestors 'none'(?:;|$)/);
    assert.match(csp, /(?:^|;\s*)object-src 'none'(?:;|$)/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    if (route.startsWith('/api')) assert.equal(response.headers.get('cache-control'), 'no-store');
    await response.arrayBuffer();
  }
  const malformed = await call('/api/auth/disconnect/source', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{'
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(malformed.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await malformed.json(), { message: 'Invalid JSON body.' });
});

test('unsafe requests reject absent, null, lookalike, and cross-site origins before changing the account', async (t) => {
  const { call } = await fixture(t);
  const cookie = seal('source', { user: { id: 'fixture-user', name: 'Fixture listener' } }, Date.now() + 60000);
  const cases = [
    {}, { Origin: 'null' }, { Origin: 'https://untrusted.example' },
    { Origin: `${origin}.untrusted.example` },
    { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }
  ];
  for (const headers of cases) {
    const response = await call('/api/auth/disconnect/source', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: '{}'
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.getSetCookie().length, 0, 'rejected write must not clear an account');
    assert.deepEqual(await response.json(), { message: 'Request origin was not allowed.' });
  }
  const accepted = await call('/api/auth/disconnect/source', {
    method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }
  });
  assert.equal(accepted.status, 200, 'normal browser disconnect with no body remains supported');
  assert.ok(accepted.headers.getSetCookie().some((value) => value.startsWith('playlist_port.source=;')));
});

test('simple form and text requests cannot mutate accounts even with a matching origin', async (t) => {
  const { call } = await fixture(t);
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=test']) {
    const response = await call('/api/auth/disconnect/source', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': contentType }, body: 'test'
    });
    assert.equal(response.status, 415);
    assert.equal(response.headers.getSetCookie().length, 0);
    await response.arrayBuffer();
  }
  const missing = await call('/api/auth/disconnect/source', { method: 'POST', headers: { Origin: origin } });
  assert.equal(missing.status, 415);
  const json = await call('/api/auth/disconnect/source', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json; charset=utf-8' }, body: '{}'
  });
  assert.equal(json.status, 200);
});

test('HEAD requests leave OAuth state untouched and ordinary sign-in still succeeds', async (t) => {
  const { call, exchanges } = await fixture(t);
  const start = await call('/api/auth/start/source');
  assert.equal(start.status, 302);
  const oauth = start.headers.getSetCookie().find((value) => value.startsWith('playlist_port.oauth='));
  assert.match(oauth, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(oauth, /Max-Age=600/);
  const cookie = oauth.split(';')[0];
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  for (const route of ['/api/auth/start/source', `/api/auth/callback?state=${state}&code=fixture`]) {
    const response = await call(route, { method: 'HEAD', headers: { Cookie: cookie } });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(exchanges(), 0);
  }
  const callback = await call(`/api/auth/callback?state=${state}&code=fixture`, { headers: { Cookie: cookie } });
  assert.equal(callback.status, 302);
  assert.equal(new URL(callback.headers.get('location')).searchParams.get('connected'), 'source');
  assert.equal(exchanges(), 1);
  const connected = callback.headers.getSetCookie().find((value) => value.startsWith('playlist_port.source='));
  assert.ok(connected);
  assert.equal(connected.includes('fixture-access'), false);
  assert.equal(connected.includes('fixture-refresh'), false);
});

test('expired sealed account and OAuth sessions are rejected without contacting Spotify', async (t) => {
  const { call, exchanges } = await fixture(t);
  const expired = seal('source', { user: { id: 'expired-user' }, accessToken: 'expired-access' }, Date.now() - 1000);
  const state = await call('/api/session', { headers: { Cookie: expired } });
  assert.equal((await state.json()).source, null);
  const unauthenticated = await call('/api/playlists', { headers: { Cookie: expired } });
  assert.equal(unauthenticated.status, 401);
  const cookie = seal('oauth', { slot: 'source', state: 'old-state', createdAt: Date.now() - 11 * 60000 }, Date.now() + 60000);
  const denied = await call('/api/auth/callback?state=old-state&code=fixture', { headers: { Cookie: cookie } });
  assert.match(new URL(denied.headers.get('location')).searchParams.get('authError'), /expired/);
  assert.equal(exchanges(), 0);
});

test('Vercel static responses use the same security policy as the API', () => {
  const { SECURITY_HEADERS } = require('../src/security.cjs');
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
  const rule = config.headers.find((entry) => entry.source === '/(.*)');
  assert.ok(rule, 'all paths must receive headers, including Vercel-served static files');
  assert.deepEqual(Object.fromEntries(rule.headers.map(({ key, value }) => [key, value])), SECURITY_HEADERS);
});
