const { test } = require('node:test');
const assert = require('node:assert/strict');

const accountPlans = [
  { label: 'Free to Free', source: 'free', destination: 'free' },
  { label: 'Free to Premium', source: 'free', destination: 'premium' },
  { label: 'Premium to Free', source: 'premium', destination: 'free' },
  { label: 'Premium to Premium', source: 'premium', destination: 'premium' },
  // Development Mode profiles can omit the subscription field entirely.
  { label: 'subscription fields absent' }
];

async function verifyCrossAccount(t, plans) {
  Object.assign(process.env, {
    SPOTIFY_CLIENT_ID: 'test-client-id', SPOTIFY_CLIENT_SECRET: 'test-client-secret',
    SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3001/api/auth/callback',
    CLIENT_ORIGIN: 'http://127.0.0.1:5173', SESSION_SECRET: 'a-long-test-only-secret-with-more-than-32-characters'
  });
  const nativeFetch = global.fetch;
  t.after(() => { global.fetch = nativeFetch; });
  const accessTokens = { source: `source${'a'.repeat(1500)}`, destination: `destination${'b'.repeat(1500)}` };
  const expectedUris = Array.from({ length: 121 }, (_, i) => `spotify:track:song${i}`);
  expectedUris.push(expectedUris[0], 'spotify:episode:episode1');
  const sourceEntries = expectedUris.map((uri, i) => i < 50 ? { track: { uri } } : { item: { uri } });
  sourceEntries.push({ item: null }, { item: { uri: 'spotify:track:local', is_local: true } });
  const stored = [];
  const writes = [];
  let created = false;
  let verificationReads = 0;
  global.fetch = async (url, options = {}) => {
    const address = String(url);
    let data;
    if (address === 'https://accounts.spotify.com/api/token') {
      const parameters = new URLSearchParams(options.body);
      const slot = parameters.get('code');
      assert.ok(accessTokens[slot]);
      data = { access_token: accessTokens[slot], refresh_token: `${slot}${'r'.repeat(1000)}`, expires_in: 3600 };
    } else if (address.startsWith('https://api.spotify.com/v1')) {
      const path = address.slice('https://api.spotify.com/v1'.length);
      const slot = Object.keys(accessTokens).find((key) => options.headers.Authorization === `Bearer ${accessTokens[key]}`);
      assert.ok(slot);
      if (path === '/me') data = {
        id: `${slot}user`, display_name: `${slot} listener`,
        ...(plans[slot] ? { product: plans[slot] } : {})
      };
      else if (path === '/playlists/source123') {
        assert.equal(slot, 'source');
        data = { owner: { id: 'sourceuser' }, description: 'Test playlist' };
      } else if (path.startsWith('/playlists/source123/items?')) {
        assert.equal(slot, 'source');
        const offset = Number(new URL(address).searchParams.get('offset'));
        data = { items: sourceEntries.slice(offset, offset + 50), next: offset + 50 < sourceEntries.length ? 'next page' : null };
      } else if (path === '/me/playlists' && options.method === 'POST') {
        assert.equal(slot, 'destination');
        assert.equal(JSON.parse(options.body).public, false);
        assert.equal(created, false, 'create exactly one private copy');
        created = true;
        data = { id: 'copy123' };
      } else if (path === '/playlists/copy123/items' && options.method === 'POST') {
        assert.equal(slot, 'destination');
        const batch = JSON.parse(options.body).uris;
        writes.push(batch.length);
        stored.push(...batch);
        data = { snapshot_id: `snapshot${stored.length}` };
      } else if (path.startsWith('/playlists/copy123/items?')) {
        assert.equal(slot, 'destination');
        verificationReads += 1;
        const offset = Number(new URL(address).searchParams.get('offset'));
        data = { items: stored.slice(offset, offset + 50).map((uri) => ({ item: { uri } })), next: offset + 50 < stored.length ? 'next page' : null };
      } else throw new Error(`Unexpected Spotify operation: ${path}`);
    } else return nativeFetch(url, options);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const server = require('../src/app.cjs').listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const jar = new Map();
  async function call(path, options = {}) {
    const response = await nativeFetch(`${base}${path}`, {
      ...options, redirect: 'manual', headers: { ...options.headers, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') }
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      if (/Expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(pair.slice(0, separator));
      else jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  for (const slot of ['source', 'destination']) {
    const start = await call(`/api/auth/start/${slot}`);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await call(`/api/auth/callback?code=${slot}&state=${state}`);
    assert.match(callback.headers.get('location'), new RegExp(`connected=${slot}`));
  }
  const connected = await (await call('/api/session')).json();
  assert.equal(connected.source.id, 'sourceuser');
  assert.equal(connected.destination.id, 'destinationuser');
  assert.equal(JSON.stringify(connected).includes(accessTokens.source), false);
  const copied = await call('/api/transfer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.CLIENT_ORIGIN },
    body: JSON.stringify({ playlistId: 'source123', name: 'Verified copy', useSecondAccount: true })
  });
  assert.equal(copied.status, 200);
  assert.deepEqual(await copied.json(), { name: 'Verified copy', url: 'https://open.spotify.com/playlist/copy123', copied: 123, skipped: 2, total: 125, verified: true });
  assert.deepEqual(writes, [100, 23]);
  assert.deepEqual(stored, expectedUris);
  assert.equal(verificationReads, 3);
  assert.deepEqual(sourceEntries.slice(0, 121).map((entry) => (entry.track || entry.item).uri), expectedUris.slice(0, 121));
  const refused = await call('/api/transfer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
    body: JSON.stringify({ playlistId: 'source123', name: 'Forbidden', useSecondAccount: true })
  });
  assert.equal(refused.status, 403);
  assert.deepEqual(writes, [100, 23]);
}

for (const plans of accountPlans) {
  test(`full OAuth and verified paginated copy work with ${plans.label} accounts`, (t) => verifyCrossAccount(t, plans));
}
