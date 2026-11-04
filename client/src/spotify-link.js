const SUPPORTED = new Set(['playlist', 'album']);
const VALID_ID = /^[A-Za-z0-9]{1,64}$/;

// Keep links separate from ordinary library searches, including unsupported links.
export function parseSpotifyLink(value) {
  const text = value.trim();
  if (!text) return null;
  let type;
  let id;
  if (/^spotify:/i.test(text)) {
    const parts = text.split(':');
    if (parts.length !== 3) return { error: 'That Spotify link is incomplete. Paste a playlist or album link.' };
    [, type, id] = parts;
  } else if (/^(?:https?:\/\/|open\.spotify\.com\/)/i.test(text)) {
    let url;
    try { url = new URL(/^open\.spotify\.com\//i.test(text) ? `https://${text}` : text); }
    catch { return { error: 'That link is incomplete. Paste a Spotify playlist or album link.' }; }
    if (url.hostname !== 'open.spotify.com' || url.username || url.password || url.port) {
      return { error: 'Use a playlist or album link from open.spotify.com.' };
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (/^intl-[a-z-]+$/i.test(parts[0] || '')) parts.shift();
    if (parts.length !== 2) return { error: 'That Spotify link is incomplete. Paste a playlist or album link.' };
    [type, id] = parts;
  } else {
    return null;
  }
  if (!SUPPORTED.has(type)) {
    return { error: 'This Spotify link is not supported. Paste a playlist or album link.' };
  }
  if (!VALID_ID.test(id || '')) return { error: 'That Spotify link has an invalid ID. Copy the link again from Spotify.' };
  return { type, id };
}
