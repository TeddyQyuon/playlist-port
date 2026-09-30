const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Spotify sign-in and private copy support legacy playlist fields without inventing item counts', async () => {
  process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3001/api/auth/callback';
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5173';
  process.env.SESSION_SECRET = 'this-is-a-long-test-only-session-secret';

  const originalFetch = global.fetch;
  const writes = [];
  global.fetch = async (url, options = {}) => {
    const path = String(url).replace('https://api.spotify.com/v1', '');
    let data;
    if (String(url).startsWith('https://accounts.spotify.com/api/token')) {
      data = { access_token: 'fake-access-token', refresh_token: 'fake-refresh-token', expires_in: 3600 };
    } else if (path === '/me') {
      data = { id: 'source-user', display_name: 'Test Listener' };
    } else if (path === '/me/playlists?limit=50&offset=0') {
      data = {
        items: [
          { id: 'source123', name: 'Road Trip', owner: { id: 'source-user' }, tracks: { total: 2 } },
          { id: 'empty123', name: 'Empty', owner: { id: 'source-user' }, items: { total: 0 }, tracks: { total: 7 } },
          { id: 'unknown123', name: 'Unknown count', owner: { id: 'source-user' } }
        ],
        total: 3,
        next: null
      };
    } else if (path === '/playlists/source123') {
      data = { name: 'Road Trip', owner: { id: 'source-user' }, description: 'Driving songs' };
    } else if (path === '/playlists/source123/items?limit=50&offset=0&additional_types=episode') {
      data = { items: [
        { is_local: false, track: { uri: 'spotify:track:first' } },
        { is_local: false, track: { uri: 'spotify:track:second' } }
      ], next: null };
    } else if (path === '/me/playlists' && options.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body) });
      data = { id: 'copy123', external_urls: { spotify: 'https://open.spotify.com/playlist/copy123' } };
    } else if (path === '/playlists/copy123/items' && options.method === 'POST') {
      writes.push({ path, body: JSON.parse(options.body) });
      data = { snapshot_id: 'snapshot123' };
    } else if (path.startsWith('/playlists/copy123/items?')) {
      data = { items: writes.at(-1).body.uris.map((uri) => ({ item: { uri } })), next: null };
    } else {
      throw new Error(`Unexpected Spotify request: ${path}`);
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const app = require('../src/app.cjs');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const start = await originalFetch(`${base}/api/auth/start/source`, { redirect: 'manual' });
    const oauthCookie = start.headers.get('set-cookie').split(';')[0];
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await originalFetch(`${base}/api/auth/callback?code=test-code&state=${state}`, {
      headers: { Cookie: oauthCookie }, redirect: 'manual'
    });
    assert.equal(callback.status, 302);
    const accountCookie = callback.headers.get('set-cookie').split(';')[0];

    const playlistResponse = await originalFetch(`${base}/api/playlists`, { headers: { Cookie: accountCookie } });
    assert.equal(playlistResponse.status, 200);
    assert.deepEqual((await playlistResponse.json()).items.map(({ name, count }) => ({ name, count })), [
      { name: 'Road Trip', count: 2 },
      { name: 'Empty', count: 0 },
      { name: 'Unknown count', count: null }
    ]);

    const copyResponse = await originalFetch(`${base}/api/transfer`, {
      method: 'POST',
      headers: { Cookie: accountCookie, Origin: process.env.CLIENT_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: 'source123', name: 'Road Trip (copy)', useSecondAccount: false })
    });
    assert.equal(copyResponse.status, 200);
    assert.deepEqual(await copyResponse.json(), {
      name: 'Road Trip (copy)', url: 'https://open.spotify.com/playlist/copy123', copied: 2, skipped: 0, total: 2, verified: true
    });
    assert.deepEqual(writes, [
      { path: '/me/playlists', body: { name: 'Road Trip (copy)', public: false, description: 'Driving songs' } },
      { path: '/playlists/copy123/items', body: { uris: ['spotify:track:first', 'spotify:track:second'] } }
    ]);
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});
