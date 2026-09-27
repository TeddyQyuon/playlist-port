const { SpotifyError, spotifyRequest } = require('./spotify.cjs');

const VALID_ID = /^[A-Za-z0-9]{1,64}$/;
const VALID_URI = /^spotify:(track|episode):[A-Za-z0-9]+$/;

async function transferPlaylist({ playlistId, name, sourceAccount, destinationAccount, request = spotifyRequest }) {
  if (!VALID_ID.test(playlistId) || !name || name.length > 100) {
    throw new SpotifyError('Choose a playlist and enter a name of at most 100 characters.', 400);
  }

  const metadata = await request(sourceAccount, `/playlists/${playlistId}`);
  if (metadata.owner?.id !== sourceAccount.user.id && !metadata.collaborative) {
    throw new SpotifyError('Spotify only lets this app read playlists you own or collaborate on.', 403);
  }

  const uris = [];
  let skipped = 0;
  let offset = 0;
  // Spotify currently returns at most 50 playlist items per read.
  for (let page = 0; page < 2000; page += 1) {
    const result = await request(sourceAccount, `/playlists/${playlistId}/items?limit=50&offset=${offset}&additional_types=episode`);
    if (!Array.isArray(result.items)) throw new SpotifyError('Spotify returned an unexpected playlist response.');
    for (const entry of result.items) {
      // Spotify can still return the deprecated `track` field. An explicit
      // null `item` means unavailable, so do not revive it from another field.
      const item = entry && Object.hasOwn(entry, 'item') ? entry.item : entry?.track;
      if (entry && !Object.hasOwn(entry, 'item') && !Object.hasOwn(entry, 'track')) {
        throw new SpotifyError('Spotify returned an unexpected playlist item. No copy was created.');
      }
      const uri = item?.uri;
      if (!entry?.is_local && VALID_URI.test(uri || '')) uris.push(uri);
      else skipped += 1;
    }
    offset += result.items.length;
    if (!result.next || result.items.length === 0) break;
    if (page === 1999) throw new SpotifyError('This playlist is too large to copy in one transfer.');
  }

  if (uris.length === 0) {
    throw new SpotifyError(
      skipped
        ? 'This playlist has no transferable tracks or episodes. Its items are local or unavailable. No copy was created.'
        : 'This playlist is empty. Choose the original playlist with tracks or episodes. No copy was created.',
      422
    );
  }

  const newPlaylist = await request(destinationAccount, '/me/playlists', {
    method: 'POST',
    body: {
      name,
      public: false,
      description: (metadata.description || '').replace(/<[^>]*>/g, '').slice(0, 300)
    }
  });
  if (!newPlaylist.id) throw new SpotifyError('Spotify did not return a new playlist ID.');

  const link = newPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${newPlaylist.id}`;
  let copied = 0;
  try {
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      await request(destinationAccount, `/playlists/${newPlaylist.id}/items`, {
        method: 'POST',
        body: { uris: batch }
      });
      copied += batch.length;
    }
  } catch (error) {
    error.partial = { name, url: link, copied, skipped, total: uris.length + skipped };
    throw error;
  }

  return { name, url: link, copied, skipped, total: uris.length + skipped };
}

module.exports = { transferPlaylist };
