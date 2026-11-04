import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpotifyLink } from '../src/spotify-link.js';

const id = '7kFyd5oyJdVX2pIi6P4iHE';
test('Spotify album share links, locale links and URIs preserve their source type', () => {
  for (const link of [
    `https://open.spotify.com/album/${id}?si=DvjbLgDWRKWmJ1ZhqqM3Zw&utm_source=copy-link`,
    `https://open.spotify.com/intl-en/album/${id}/`,
    `open.spotify.com/album/${id}`, `spotify:album:${id}`
  ]) assert.deepEqual(parseSpotifyLink(link), { type: 'album', id });
  assert.deepEqual(parseSpotifyLink(`https://open.spotify.com/playlist/${id}?si=share`), { type: 'playlist', id });
  assert.equal(parseSpotifyLink('Road trip songs'), null);
});

test('unsupported, malformed and lookalike links show an error instead of becoming a library search', () => {
  for (const value of [
    `https://open.spotify.com/track/${id}`, `spotify:artist:${id}`,
    'https://open.spotify.com/album/', `https://open.spotify.com/album/${id}/extra`,
    `https://open.spotify.com.evil.example/album/${id}`, `https://open.spotify.com@evil.example/album/${id}`,
    'spotify:album:bad/id', 'https://open.spotify.com/album/%3F', 'spotify:album:'
  ]) assert.equal(typeof parseSpotifyLink(value).error, 'string', value);
});
