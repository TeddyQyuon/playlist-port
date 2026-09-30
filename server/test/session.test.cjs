const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { sealedSession } = require('../src/sealed-session.cjs');

const secret = 'test-only-secret-with-more-than-32-characters';
const account = (id) => ({
  user: { id, name: id }, accessToken: `${id}${'a'.repeat(1500)}`,
  refreshToken: 'r'.repeat(1000), expiresAt: Date.now() + 3600000
});

async function fixture(t) {
  const app = express();
  app.use(express.json());
  app.use(sealedSession(secret, true));
  app.post('/connect/:slot', (req, res) => {
    req.session[req.params.slot] = req.body;
    req.session.save((error) => res.status(error ? 500 : 200).json({ ok: !error }));
  });
  app.post('/disconnect/:slot', (req, res) => {
    delete req.session[req.params.slot];
    res.json({ ok: true });
  });
  app.get('/state', (req, res) => res.json({ source: req.session.source?.user || null, destination: req.session.destination?.user || null }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const jar = new Map();
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body) {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      if (/Expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(pair.slice(0, separator));
      else jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  return { call, jar };
}

test('two production-sized token pairs survive connection, refresh, and independent disconnect', async (t) => {
  const { call, jar } = await fixture(t);
  assert.equal((await call('/connect/source', account('source'))).status, 200);
  const destination = await call('/connect/destination', account('destination'));
  assert.equal(destination.status, 200);
  assert.deepEqual(await (await call('/state')).json(), {
    source: { id: 'source', name: 'source' }, destination: { id: 'destination', name: 'destination' }
  });
  for (const cookie of destination.headers.getSetCookie()) {
    assert.ok(cookie.length < 4096);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
  }
  assert.ok([...jar.values()].join('').length > 3800, 'regression: the old single cookie could not hold both accounts');
  const refreshed = await call('/connect/source', { ...account('source'), accessToken: 'refreshed' });
  assert.equal(refreshed.headers.getSetCookie().length, 1, 'source refresh must not rewrite destination credentials');
  await call('/disconnect/destination', {});
  assert.deepEqual(await (await call('/state')).json(), { source: { id: 'source', name: 'source' }, destination: null });
});

test('a failed oversized destination save preserves the source and returns one error response', async (t) => {
  const { call } = await fixture(t);
  await call('/connect/source', account('source'));
  const denied = await call('/connect/destination', { ...account('destination'), accessToken: 'x'.repeat(10000) });
  assert.equal(denied.status, 500);
  assert.deepEqual(await denied.json(), { ok: false });
  assert.equal(denied.headers.getSetCookie().length, 0);
  assert.deepEqual(await (await call('/state')).json(), { source: { id: 'source', name: 'source' }, destination: null });
});

test('encrypted account cookies cannot be tampered with or swapped between slots', async (t) => {
  const { call, jar } = await fixture(t);
  await call('/connect/source', account('source'));
  await call('/connect/destination', account('destination'));
  jar.set('playlist_port.source', jar.get('playlist_port.destination'));
  assert.deepEqual(await (await call('/state')).json(), { source: null, destination: { id: 'destination', name: 'destination' } });
  jar.set('playlist_port.destination', `${jar.get('playlist_port.destination')}x`);
  assert.deepEqual(await (await call('/state')).json(), { source: null, destination: null });
});

test('existing single-cookie sessions migrate without losing an account', async (t) => {
  const { call, jar } = await fixture(t);
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({
    expiresAt: Date.now() + 86400000, values: { source: account('source') }
  })), cipher.final()]);
  jar.set('playlist_port.session', Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'));
  assert.deepEqual(await (await call('/state')).json(), { source: { id: 'source', name: 'source' }, destination: null });
  assert.equal(jar.has('playlist_port.session'), false);
  assert.equal(jar.has('playlist_port.source'), true);
  assert.deepEqual(await (await call('/state')).json(), { source: { id: 'source', name: 'source' }, destination: null });
});
