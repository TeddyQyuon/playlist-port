const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferPlaylist } = require('../src/transfer.cjs');

test('transfers Liked Songs to destination playlist', async () => {
  const sourceAccount = { user: { id: 'source-user' } };
  const destinationAccount = { user: { id: 'destination-user' } };
  const writes = [];

  const request = async (account, path, options = {}) => {
    if (path.includes('/me/tracks?limit=50&offset=0')) {
      return {
        items: [
          { track: { uri: 'spotify:track:liked1' }, is_local: false },
          { track: { uri: 'spotify:track:liked2' }, is_local: false }
        ],
        next: null
      };
    }
    if (path === '/me/playlists' && options.method === 'POST') {
      writes.push({ path, body: options.body });
      return { id: 'new-liked-copy', external_urls: { spotify: 'https://open.spotify.com/playlist/new-liked-copy' } };
    }
    if (path === '/playlists/new-liked-copy/items' && options.method === 'POST') {
      writes.push({ path, body: options.body });
      return { snapshot_id: 'snap123' };
    }
    if (path.startsWith('/playlists/new-liked-copy/items?')) {
      return {
        items: [
          { item: { uri: 'spotify:track:liked1' } },
          { item: { uri: 'spotify:track:liked2' } }
        ],
        next: null
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const result = await transferPlaylist({
    playlistId: 'liked-songs',
    name: 'My Saved Liked Songs',
    sourceAccount,
    destinationAccount,
    request
  });

  assert.equal(result.copied, 2);
  assert.equal(result.name, 'My Saved Liked Songs');
  assert.equal(result.verified, true);
  assert.deepEqual(writes[0].body, {
    name: 'My Saved Liked Songs',
    public: false,
    description: 'Transferred from Liked Songs'
  });
  assert.deepEqual(writes[1].body.uris, ['spotify:track:liked1', 'spotify:track:liked2']);
});
