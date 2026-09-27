const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

class SpotifyError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
  }
}

function credentials() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  return Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
}

async function tokenRequest(parameters) {
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials()}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(parameters),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new SpotifyError('Could not reach Spotify. Please try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SpotifyError(data.error_description || 'Spotify authorization failed.', response.status);
  }
  return data;
}

async function exchangeCode(code) {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI
  });
}

async function refreshAccount(account) {
  if (!account.refreshToken) throw new SpotifyError('Please reconnect your Spotify account.', 401);
  const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: account.refreshToken });
  account.accessToken = data.access_token;
  account.refreshToken = data.refresh_token || account.refreshToken;
  account.expiresAt = Date.now() + data.expires_in * 1000;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyRequest(account, path, { method = 'GET', body } = {}) {
  if (!account || !path.startsWith('/') || path.startsWith('//')) {
    throw new SpotifyError('Invalid Spotify request.', 400);
  }
  if (account.expiresAt < Date.now() + 60_000) await refreshAccount(account);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw new SpotifyError('Could not reach Spotify. Please try again.');
    }

    if (response.status === 401 && attempt === 0 && account.refreshToken) {
      await refreshAccount(account);
      continue;
    }
    // Only repeat reads. Repeating a write could create duplicate playlists or items.
    if (response.status === 429 && method === 'GET' && attempt < 2) {
      const seconds = Number(response.headers.get('retry-after'));
      await delay(Number.isFinite(seconds) ? Math.min(Math.max(seconds, 1), 5) * 1000 : 1000);
      continue;
    }
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      if (response.ok) throw new SpotifyError('Spotify returned an unexpected response. Please try again.');
      // Account access refusals can arrive as plain text rather than JSON.
      data = { error: { message: responseText.trim().slice(0, 200) } };
    }
    if (!response.ok) {
      const spotifyMessage = typeof data.error?.message === 'string'
        ? data.error.message
        : typeof data.error === 'string' ? data.error : '';
      const deniedMessage = /insufficient.*scope/i.test(spotifyMessage)
        ? 'Spotify did not grant the required permissions. Disconnect and reconnect this account, then approve playlist access.'
        : path === '/me'
          ? 'Spotify refused this account. The app owner should check its exact Spotify account name and email in Playlist Port\'s Users Management, and verify the app owner\'s Premium subscription is active. Then connect again.'
          : 'Spotify denied this playlist request. Check playlist ownership and the account\'s app access, or reconnect to approve playlist permissions.';
      const message = response.status === 429
        ? 'Spotify is rate limiting requests. Wait a moment and try again.'
        : response.status === 403
          ? deniedMessage
          : response.status === 401
            ? 'Spotify authorization expired. Reconnect your account.'
            : data.error?.message || 'Spotify could not complete this request.';
      const error = new SpotifyError(message, response.status);
      error.spotifyPath = path.split('?')[0];
      error.spotifyMessage = spotifyMessage.slice(0, 200);
      throw error;
    }
    return data;
  }
  throw new SpotifyError('Spotify did not accept the request. Please try again.');
}

module.exports = { SpotifyError, exchangeCode, spotifyRequest };
