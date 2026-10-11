const { SpotifyError, spotifyRequest } = require('./spotify.cjs');

const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;
const VALID_URI = /^spotify:(track|episode):[A-Za-z0-9]+$/;

async function readItems(account, playlistId, request) {
  const uris = [];
  let skipped = 0;
  let offset = 0;
  for (let page = 0; page < 2000; page += 1) {
    const result = await request(account, `/playlists/${playlistId}/items?limit=50&offset=${offset}&additional_types=episode`);
    if (!Array.isArray(result.items)) throw new SpotifyError('Spotify returned an unexpected playlist response.');
    for (const entry of result.items) {
      const item = entry && Object.hasOwn(entry, 'item') ? entry.item : entry?.track;
      if (entry && !Object.hasOwn(entry, 'item') && !Object.hasOwn(entry, 'track')) {
        throw new SpotifyError('Spotify returned an unexpected playlist item.');
      }
      // Track relinking can return a different playable URI in another country.
      // Preserve the original Spotify reference when it is available.
      const uri = item?.linked_from?.uri || item?.uri;
      if (!entry?.is_local && !item?.is_local && VALID_URI.test(uri || '')) uris.push(uri);
      else skipped += 1;
    }
    offset += result.items.length;
    if (!result.next) return { uris, skipped };
    if (result.items.length === 0) throw new SpotifyError('Spotify returned an incomplete playlist page. Please try again.');
  }
  throw new SpotifyError('This playlist is too large to copy in one transfer.');
}

async function readLikedSongs(account, request) {
  const uris = [];
  let skipped = 0;
  let offset = 0;
  for (let page = 0; page < 2000; page += 1) {
    let result;
    try {
      result = await request(account, `/me/tracks?limit=50&offset=${offset}`);
    } catch (err) {
      if (err.status === 403) {
        throw new SpotifyError('Please disconnect and reconnect Spotify to grant access to your Liked Songs.', 403);
      }
      throw err;
    }
    if (!Array.isArray(result.items)) throw new SpotifyError('Spotify returned an unexpected response for Liked Songs.');
    for (const entry of result.items) {
      const track = entry?.track;
      const uri = track?.linked_from?.uri || track?.uri;
      if (!entry?.is_local && !track?.is_local && VALID_URI.test(uri || '')) {
        uris.push(uri);
      } else {
        skipped += 1;
      }
    }
    offset += result.items.length;
    if (!result.next) return { uris, skipped };
    if (result.items.length === 0) throw new SpotifyError('Incomplete Liked Songs page. Please try again.');
  }
  return { uris, skipped };
}

async function readPublicPlaylistItems(playlistId) {
  let res;
  try {
    res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new SpotifyError('Could not reach Spotify to load this public playlist.');
  }

  if (!res.ok) {
    throw new SpotifyError('Could not retrieve tracks from this playlist. Ensure the playlist is public.', 404);
  }

  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const uris = [];
  let skipped = 0;

  if (m) {
    try {
      const d = JSON.parse(m[1]);
      const trackList = d.props?.pageProps?.state?.data?.entity?.trackList;
      if (Array.isArray(trackList)) {
        for (const track of trackList) {
          if (track && track.uri && VALID_URI.test(track.uri) && !track.is_local) {
            uris.push(track.uri);
          } else {
            skipped += 1;
          }
        }
      }
    } catch {}
  }

  if (uris.length === 0) {
    const matches = html.match(/spotify:(?:track|episode):[a-zA-Z0-9]+/g) || [];
    const seen = new Set();
    for (const uri of matches) {
      if (!seen.has(uri) && VALID_URI.test(uri)) {
        seen.add(uri);
        uris.push(uri);
      }
    }
  }

  return { uris, skipped };
}

async function transferPlaylist({ playlistId, name, sourceAccount, destinationAccount, request = spotifyRequest }) {
  if (typeof playlistId !== 'string' || !VALID_ID.test(playlistId) || typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new SpotifyError('Choose a playlist and enter a name of at most 100 characters.', 400);
  }

  let uris = [];
  let skipped = 0;
  let playlistDescription = '';

  if (playlistId === 'liked-songs') {
    playlistDescription = 'Transferred from Liked Songs';
    const res = await readLikedSongs(sourceAccount, request);
    uris = res.uris;
    skipped = res.skipped;
  } else {
    let metadata = null;
    try {
      metadata = await request(sourceAccount, `/playlists/${playlistId}`);
    } catch {}

    playlistDescription = ((metadata && metadata.description) || '').replace(/<[^>]*>/g, '').slice(0, 300);
    const isOwnedOrCollaborative = metadata && (metadata.owner?.id === sourceAccount.user.id || Boolean(metadata.collaborative));

    if (isOwnedOrCollaborative) {
      try {
        const res = await readItems(sourceAccount, playlistId, request);
        uris = res.uris;
        skipped = res.skipped;
      } catch (err) {
        if (err.status === 403) {
          const pub = await readPublicPlaylistItems(playlistId);
          uris = pub.uris;
          skipped = pub.skipped;
        } else {
          throw err;
        }
      }
    } else {
      const pub = await readPublicPlaylistItems(playlistId);
      uris = pub.uris;
      skipped = pub.skipped;
    }
  }

  if (uris.length === 0) {
    throw new SpotifyError(
      skipped
        ? 'This playlist has no transferable tracks or episodes. Its items are local or unavailable. No copy was created.'
        : 'This playlist is empty. Choose a playlist with tracks or episodes. No copy was created.',
      422
    );
  }

  const newPlaylist = await request(destinationAccount, '/me/playlists', {
    method: 'POST',
    body: {
      name,
      public: false,
      description: playlistDescription
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
    // A successful POST alone is not a verified transfer. Read the persisted
    // destination through its account and compare every URI, including duplicates.
    const destination = await readItems(destinationAccount, newPlaylist.id, request);
    if (destination.skipped || destination.uris.length !== uris.length ||
        destination.uris.some((uri, index) => uri !== uris[index])) {
      throw new SpotifyError('Spotify saved a different item count or order. Open the saved playlist before trying another copy.');
    }
  } catch (error) {
    error.partial = { name, url: link, copied, skipped, total: uris.length + skipped };
    throw error;
  }

  return { name, url: link, copied, skipped, total: uris.length + skipped, verified: true };
}

module.exports = { transferPlaylist };
