const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spotifyRequest } = require('../src/spotify.cjs');

test('insufficient Spotify scopes explain reconnecting and retain a safe diagnostic', async (t) => {
  const nativeFetch = global.fetch;
  t.after(() => { global.fetch = nativeFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    error: { status: 403, message: 'Insufficient client scope' }
  }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(
    spotifyRequest({ accessToken: 'test-token', expiresAt: Date.now() + 3600000 }, '/me'),
    (error) => error.status === 403 && /Disconnect and reconnect/.test(error.message) &&
      !/Users Management/.test(error.message) && error.spotifyPath === '/me' &&
      error.spotifyMessage === 'Insufficient client scope'
  );
});

test('plain-text profile denial retains the Spotify diagnosis and explains account access', async (t) => {
  const nativeFetch = global.fetch;
  t.after(() => { global.fetch = nativeFetch; });
  const diagnosis = 'User not registered in the Developer Dashboard';
  global.fetch = async () => new Response(diagnosis, {
    status: 403, headers: { 'Content-Type': 'text/plain' }
  });

  await assert.rejects(
    spotifyRequest({ accessToken: 'test-token', expiresAt: Date.now() + 3600000 }, '/me'),
    (error) => error.status === 403 && /Users Management/.test(error.message) &&
      !/playlist ownership/i.test(error.message) && error.spotifyPath === '/me' &&
      error.spotifyMessage === diagnosis
  );
});
