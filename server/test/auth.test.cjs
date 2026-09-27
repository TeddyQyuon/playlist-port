const { test } = require('node:test');
const assert = require('node:assert/strict');

test('OAuth state is checked and account tokens remain server-side', async () => {
  process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3001/api/auth/callback';
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5173';
  process.env.SESSION_SECRET = 'this-is-a-long-test-only-session-secret';

  const nativeFetch = global.fetch;
  let denyProfile = false;
  const app = require('../src/app.cjs');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://accounts.spotify.com/api/token')) {
      return new Response(JSON.stringify({ access_token: 'private-token', refresh_token: 'private-refresh', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).startsWith('https://api.spotify.com/v1/me')) {
      assert.equal(options.headers.Authorization, 'Bearer private-token');
      if (denyProfile) {
        return new Response(JSON.stringify({ error: { status: 403, message: 'User not registered in the Developer Dashboard' } }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ id: 'person123', display_name: 'Test Listener' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return nativeFetch(url, options);
  };

  try {
    const start = await nativeFetch(`${base}/api/auth/start/source`, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const cookie = start.headers.get('set-cookie').split(';')[0];
    assert.match(start.headers.get('set-cookie'), /HttpOnly/);
    assert.equal(cookie.includes('private-token'), false);
    const authorize = new URL(start.headers.get('location'));
    assert.equal(authorize.hostname, 'accounts.spotify.com');
    assert.equal(authorize.searchParams.get('redirect_uri'), process.env.SPOTIFY_REDIRECT_URI);
    const state = authorize.searchParams.get('state');
    assert.ok(state);

    const invalid = await nativeFetch(`${base}/api/auth/callback?code=x&state=wrong`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.match(invalid.headers.get('location'), /authError=/);

    const restarted = await nativeFetch(`${base}/api/auth/start/source`, { headers: { Cookie: cookie }, redirect: 'manual' });
    const freshCookie = restarted.headers.get('set-cookie').split(';')[0];
    const freshState = new URL(restarted.headers.get('location')).searchParams.get('state');
    const callback = await nativeFetch(`${base}/api/auth/callback?code=valid&state=${freshState}`, { headers: { Cookie: freshCookie }, redirect: 'manual' });
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get('location'), /connected=source/);
    const connectedCookie = callback.headers.get('set-cookie').split(';')[0];
    assert.equal(connectedCookie.includes('private-token'), false);
    assert.equal(connectedCookie.includes('private-refresh'), false);

    const result = await nativeFetch(`${base}/api/session`, { headers: { Cookie: connectedCookie } });
    const session = await result.json();
    assert.deepEqual(session.source, { id: 'person123', name: 'Test Listener' });
    assert.equal(JSON.stringify(session).includes('private-token'), false);

    const tampered = await nativeFetch(`${base}/api/session`, {
      headers: { Cookie: `${connectedCookie}x` }
    });
    assert.equal((await tampered.json()).source, null);

    // A denied second account must not erase the connected source or blame
    // playlist ownership when Spotify refused access to the account profile.
    const second = await nativeFetch(`${base}/api/auth/start/destination`, {
      headers: { Cookie: connectedCookie }, redirect: 'manual'
    });
    const secondCookie = second.headers.get('set-cookie').split(';')[0];
    const secondState = new URL(second.headers.get('location')).searchParams.get('state');
    denyProfile = true;
    const refused = await nativeFetch(`${base}/api/auth/callback?code=second&state=${secondState}`, {
      headers: { Cookie: secondCookie }, redirect: 'manual'
    });
    const message = new URL(refused.headers.get('location')).searchParams.get('authError');
    assert.match(message, /destination Spotify account/);
    assert.match(message, /Users Management/);
    assert.doesNotMatch(message, /own or collaborate/);
    const preserved = await nativeFetch(`${base}/api/session`, {
      headers: { Cookie: refused.headers.get('set-cookie').split(';')[0] }
    });
    assert.deepEqual((await preserved.json()).source, { id: 'person123', name: 'Test Listener' });
  } finally {
    global.fetch = nativeFetch;
    server.close();
  }
});
