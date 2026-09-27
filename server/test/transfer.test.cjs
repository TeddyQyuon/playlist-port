const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferPlaylist } = require('../src/transfer.cjs');

const sourceAccount = { user: { id: 'source-user' } };
const destinationAccount = { user: { id: 'destination-user' } };
const item = (index) => ({ item: { uri: `spotify:track:${index}a` }, is_local: false });

test('copies every page in order using the 2026 items endpoints and 100 item writes', async () => {
  const calls = [];
  const request = async (account, path, options = {}) => {
    calls.push({ account, path, options });
    if (path === '/playlists/source123') return { name: 'Source', owner: { id: 'source-user' }, description: 'A good mix' };
    if (path.includes('offset=0')) return { items: Array.from({ length: 50 }, (_, i) => item(i)), next: 'https://api.spotify.com/v1/playlists/source123/items?limit=50&offset=50' };
    if (path.includes('offset=50')) return { items: Array.from({ length: 50 }, (_, i) => item(i + 50)), next: 'https://api.spotify.com/v1/playlists/source123/items?limit=50&offset=100' };
    if (path.includes('offset=100')) return { items: [...Array.from({ length: 23 }, (_, i) => item(i + 100)), { item: null }, { item: { uri: 'spotify:track:local1' }, is_local: true }], next: null };
    if (path === '/me/playlists') return { id: 'new123', external_urls: { spotify: 'https://open.spotify.com/playlist/new123' } };
    if (path === '/playlists/new123/items') return { snapshot_id: 'snapshot' };
    throw new Error(`Unexpected request: ${path}`);
  };

  const result = await transferPlaylist({ playlistId: 'source123', name: 'Source (copy)', sourceAccount, destinationAccount, request });
  assert.deepEqual(result, { name: 'Source (copy)', url: 'https://open.spotify.com/playlist/new123', copied: 123, skipped: 2, total: 125 });
  const writes = calls.filter((call) => call.path === '/playlists/new123/items');
  assert.deepEqual(writes.map((call) => call.options.body.uris.length), [100, 23]);
  assert.equal(writes[0].options.body.uris[0], 'spotify:track:0a');
  assert.equal(writes[1].options.body.uris.at(-1), 'spotify:track:122a');
  assert.equal(calls.find((call) => call.path === '/me/playlists').options.body.public, false);
  assert.equal(writes.every((call) => call.account === destinationAccount), true);
});

test('copies legacy track payloads across pages and respects an explicit modern null item', async () => {
  const firstUris = Array.from({ length: 49 }, (_, index) => `spotify:track:legacy${index}`);
  const writes = [];
  const reads = [];
  const request = async (_account, path, options = {}) => {
    if (path === '/playlists/source123') return { owner: { id: 'source-user' } };
    if (path === '/playlists/source123/items?limit=50&offset=0&additional_types=episode') {
      reads.push(path);
      return {
        items: [
          ...firstUris.map((uri) => ({ track: { uri }, is_local: false })),
          { track: { uri: 'spotify:track:local' }, is_local: true }
        ],
        next: 'https://api.spotify.com/v1/playlists/source123/items?limit=50&offset=50'
      };
    }
    if (path === '/playlists/source123/items?limit=50&offset=50&additional_types=episode') {
      reads.push(path);
      return {
        items: [
          { track: { uri: 'spotify:track:last' }, is_local: false },
          { track: { uri: 'spotify:episode:episode1' }, is_local: false },
          { track: null, is_local: false },
          { item: null, track: { uri: 'spotify:track:stale' }, is_local: false },
          { item: { uri: 'spotify:track:modern' }, track: { uri: 'spotify:track:stale2' }, is_local: false }
        ],
        next: null
      };
    }
    if (path === '/me/playlists') return { id: 'legacycopy123' };
    if (path === '/playlists/legacycopy123/items') {
      writes.push(options.body.uris);
      return { snapshot_id: 'snapshot' };
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const result = await transferPlaylist({ playlistId: 'source123', name: 'Legacy copy', sourceAccount, destinationAccount, request });
  assert.deepEqual(result, {
    name: 'Legacy copy', url: 'https://open.spotify.com/playlist/legacycopy123', copied: 52, skipped: 3, total: 55
  });
  assert.equal(reads.length, 2);
  assert.deepEqual(writes, [[...firstUris, 'spotify:track:last', 'spotify:episode:episode1', 'spotify:track:modern']]);
});

for (const { label, items } of [
  { label: 'empty', items: [] },
  {
    label: 'only unavailable or local',
    items: [
      { item: null, is_local: false },
      { track: null, is_local: false },
      { item: { uri: 'spotify:track:local1' }, is_local: true },
      { track: { uri: 'spotify:track:local2' }, is_local: true }
    ]
  }
]) {
  test(`does not create a destination playlist when the source is ${label}`, async () => {
    const writes = [];
    const request = async (_account, path, options = {}) => {
      if (options.method === 'POST') writes.push(path);
      if (path === '/playlists/source123') return { owner: { id: 'source-user' } };
      if (path === '/playlists/source123/items?limit=50&offset=0&additional_types=episode') {
        return { items, total: items.length, next: null };
      }
      if (path === '/me/playlists') return { id: 'shouldnotexist123' };
      throw new Error(`Unexpected request: ${path}`);
    };

    await assert.rejects(
      transferPlaylist({ playlistId: 'source123', name: 'No empty copy', sourceAccount, destinationAccount, request }),
      (error) => /empty|no transferable/i.test(error.message)
    );
    assert.deepEqual(writes, [], 'source validation must finish before creating a destination playlist');
  });
}

test('reports the created playlist and copied count if Spotify fails during a later batch', async () => {
  let writes = 0;
  const request = async (_account, path) => {
    if (path === '/playlists/source123') return { owner: { id: 'source-user' } };
    if (path.includes('/items?')) {
      const offset = Number(new URL(path, 'https://api.spotify.com').searchParams.get('offset'));
      return {
        items: Array.from({ length: Math.min(50, 101 - offset) }, (_, i) => item(i + offset)),
        next: offset + 50 < 101 ? `https://api.spotify.com/v1/playlists/source123/items?limit=50&offset=${offset + 50}` : null
      };
    }
    if (path === '/me/playlists') return { id: 'new123' };
    if (path === '/playlists/new123/items') {
      writes += 1;
      if (writes === 2) throw new Error('Rate limited');
      return {};
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  await assert.rejects(
    transferPlaylist({ playlistId: 'source123', name: 'Partial', sourceAccount, destinationAccount, request }),
    (error) => error.message === 'Rate limited' && error.partial.copied === 100 && error.partial.url === 'https://open.spotify.com/playlist/new123'
  );
});
