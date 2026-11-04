const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferPlaylist } = require('../src/transfer.cjs');
const { SpotifyError } = require('../src/spotify.cjs');
const sourceAccount = { user: { id: 'source' } };
const destinationAccount = { user: { id: 'destination' } };

test('album copies read every page in album order, preserve duplicates and relinking, and verify private playlist writes', async () => {
  const expected = Array.from({ length: 122 }, (_, i) => `spotify:track:song${i}`);
  expected[121] = expected[0];
  const tracks = expected.map((uri) => ({ uri }));
  tracks[1] = { uri: 'spotify:track:relinked', linked_from: { uri: expected[1] } };
  tracks.push(null, { uri: 'spotify:track:local', is_local: true }, { uri: 'spotify:track:unavailable', is_playable: false });
  const stored = [];
  const sizes = [];
  const offsets = [];
  const request = async (account, path, options = {}) => {
    if (path === '/albums/album123') return { name: 'Album', total_tracks: 125 };
    const offset = Number(new URL(path, 'https://api.spotify.com').searchParams.get('offset'));
    if (path.startsWith('/albums/album123/tracks?')) {
      assert.equal(account, sourceAccount);
      offsets.push(offset);
      return { items: tracks.slice(offset, offset + 50), next: offset + 50 < tracks.length ? 'next' : null };
    }
    assert.equal(account, destinationAccount);
    if (path === '/me/playlists') {
      assert.equal(options.body.public, false);
      return { id: 'copy123' };
    }
    if (path === '/playlists/copy123/items') {
      stored.push(...options.body.uris);
      sizes.push(options.body.uris.length);
      return { snapshot_id: 'saved' };
    }
    if (path.startsWith('/playlists/copy123/items?')) return { items: stored.slice(offset, offset + 50).map((uri) => ({ item: { uri } })), next: offset + 50 < stored.length ? 'next' : null };
    throw new Error(path);
  };
  const result = await transferPlaylist({ playlistId: 'album123', sourceType: 'album', name: 'Album (copy)', sourceAccount, destinationAccount, request });
  assert.deepEqual(offsets, [0, 50, 100]);
  assert.deepEqual(sizes, [100, 22]);
  assert.deepEqual(stored, expected);
  assert.equal(result.copied, 122);
  assert.equal(result.skipped, 3);
  assert.equal(result.verified, true);
});

test('album read failures, truncated pages and empty albums never create a destination', async () => {
  for (const mode of ['denied', 'incomplete-page', 'incomplete-total', 'empty']) {
    let writes = 0;
    const request = async (_account, path, options = {}) => {
      if (options.method === 'POST') { writes++; throw new Error('Unexpected write'); }
      if (mode === 'denied') throw new SpotifyError('Album unavailable in this account.', 403);
      if (path === '/albums/album123') return { name: 'Album', total_tracks: mode === 'empty' ? 0 : 2 };
      return { items: [], next: mode === 'incomplete-page' ? 'next' : null };
    };
    await assert.rejects(transferPlaylist({ playlistId: 'album123', sourceType: 'album', name: 'Copy', sourceAccount, destinationAccount, request }));
    assert.equal(writes, 0, mode);
  }
  await assert.rejects(transferPlaylist({ playlistId: 'album123', sourceType: 'track', name: 'Copy', request: () => assert.fail('Invalid type must not reach Spotify') }), { status: 400 });
});

test('album metadata and transfer API carry album source IDs through an authenticated session', async (t) => {
  Object.assign(process.env, {
    SPOTIFY_CLIENT_ID: 'test-client-id', SPOTIFY_CLIENT_SECRET: 'test-client-secret',
    SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3001/api/auth/callback',
    CLIENT_ORIGIN: 'http://127.0.0.1:5173', SESSION_SECRET: 'a-long-test-only-session-secret-for-albums'
  });
  const nativeFetch = global.fetch;
  t.after(() => { global.fetch = nativeFetch; });
  const stored = [];
  let creates = 0;
  global.fetch = async (url, options = {}) => {
    const path = String(url).replace('https://api.spotify.com/v1', '');
    let data;
    if (String(url).startsWith('https://accounts.spotify.com/api/token')) data = { access_token: 'fake', refresh_token: 'fake-refresh', expires_in: 3600 };
    else if (path === '/me') data = { id: 'source', display_name: 'Listener' };
    else if (path === '/albums/7kFyd5oyJdVX2pIi6P4iHE') data = { id: '7kFyd5oyJdVX2pIi6P4iHE', name: 'Test Album', artists: [{ name: 'Artist' }], total_tracks: 2 };
    else if (path.startsWith('/albums/7kFyd5oyJdVX2pIi6P4iHE/tracks?')) data = { items: [{ uri: 'spotify:track:first' }, { uri: 'spotify:track:second' }], next: null };
    else if (path === '/me/playlists') { creates++; data = { id: 'copy123' }; }
    else if (path === '/playlists/copy123/items') { stored.push(...JSON.parse(options.body).uris); data = { snapshot_id: 'saved' }; }
    else if (path.startsWith('/playlists/copy123/items?')) data = { items: stored.map((uri) => ({ item: { uri } })), next: null };
    else throw new Error(`Unexpected Spotify request: ${path}`);
    return Response.json(data);
  };
  const server = require('../src/app.cjs').listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const jar = new Map();
  const call = async (path, options = {}) => {
    const response = await nativeFetch(`${base}${path}`, { ...options, redirect: 'manual', headers: { Origin: process.env.CLIENT_ORIGIN, 'Content-Type': 'application/json', ...options.headers, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
    return response;
  };
  assert.equal((await call('/api/album/7kFyd5oyJdVX2pIi6P4iHE')).status, 401);
  const login = await call('/api/auth/start/source');
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  assert.equal((await call(`/api/auth/callback?code=test&state=${state}`)).status, 302);
  const metadata = await (await call('/api/album/7kFyd5oyJdVX2pIi6P4iHE')).json();
  assert.equal(metadata.id, 'album-7kFyd5oyJdVX2pIi6P4iHE');
  assert.equal(metadata.sourceId, '7kFyd5oyJdVX2pIi6P4iHE');
  assert.equal(metadata.sourceType, 'album');
  assert.equal(metadata.owner, 'Artist');
  const copy = await call('/api/transfer', { method: 'POST', body: JSON.stringify({ playlistId: metadata.sourceId, sourceType: metadata.sourceType, name: 'Album (copy)', useSecondAccount: false }) });
  assert.equal(copy.status, 200);
  assert.equal((await copy.json()).verified, true);
  assert.deepEqual(stored, ['spotify:track:first', 'spotify:track:second']);
  assert.equal(creates, 1);
  assert.equal((await call('/api/transfer', { method: 'POST', body: JSON.stringify({ playlistId: 'album123', sourceType: 'track', name: 'Invalid', useSecondAccount: false }) })).status, 400);
  assert.equal(creates, 1);
});
