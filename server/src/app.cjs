const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { SpotifyError, exchangeCode, spotifyRequest } = require('./spotify.cjs');
const { transferPlaylist } = require('./transfer.cjs');
const { sealedSession } = require('./sealed-session.cjs');
const { clientDocument } = require('./client-document.cjs');

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://127.0.0.1:5173');
const configured = Boolean(
  process.env.SPOTIFY_CLIENT_ID &&
  process.env.SPOTIFY_CLIENT_SECRET &&
  process.env.SPOTIFY_REDIRECT_URI &&
  !process.env.SPOTIFY_CLIENT_ID.startsWith('your_') &&
  !process.env.SPOTIFY_CLIENT_SECRET.startsWith('your_')
);

app.disable('x-powered-by');
if (clientOrigin.startsWith('https://')) app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
const sessionMiddleware = configured
  ? sealedSession(
      process.env.SESSION_SECRET || (process.env.VERCEL ? '' : crypto.randomBytes(32).toString('hex')),
      clientOrigin.startsWith('https://')
    )
  // The public demo can load without Spotify credentials. It does not accept
  // or persist account state until Spotify is configured.
  : (req, _res, next) => {
      req.session = { save: (callback) => callback?.(null) };
      next();
    };

app.use(sessionMiddleware);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin && req.headers.origin !== clientOrigin) {
    return res.status(403).json({ message: 'Request origin was not allowed.' });
  }
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const publicAccount = (account) => account ? account.user : null;
const hasSlot = (slot) => slot === 'source' || slot === 'destination';

app.get('/api/session', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ configured, source: publicAccount(req.session.source), destination: publicAccount(req.session.destination) });
});

app.get('/api/auth/start/:slot', (req, res, next) => {
  if (!hasSlot(req.params.slot)) return res.status(400).json({ message: 'Unknown account slot.' });
  if (!configured) return res.status(503).json({ message: 'Spotify sign-in is not configured yet.' });

  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauth = { slot: req.params.slot, state, createdAt: Date.now() };
  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state,
    scope: 'playlist-read-private playlist-read-collaborative playlist-modify-private user-read-private',
    show_dialog: 'true'
  }).toString();

  req.session.save((error) => error ? next(error) : res.redirect(url.toString()));
});

app.get('/api/auth/callback', wrap(async (req, res) => {
  const pending = req.session.oauth;
  delete req.session.oauth;
  if (!pending || pending.state !== req.query.state || Date.now() - pending.createdAt > 10 * 60 * 1000) {
    return res.redirect(`${clientOrigin}/?authError=${encodeURIComponent('Spotify sign-in expired. Please try again.')}`);
  }
  if (req.query.error || !req.query.code) {
    return res.redirect(`${clientOrigin}/?authError=${encodeURIComponent('Spotify authorization was cancelled.')}`);
  }

  try {
    const token = await exchangeCode(req.query.code);
    const account = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000
    };
    const profile = await spotifyRequest(account, '/me');
    account.user = { id: profile.id, name: profile.display_name || profile.id };
    req.session[pending.slot] = account;
    req.session.save((error) => {
      if (error) return res.redirect(`${clientOrigin}/?authError=${encodeURIComponent('Could not save the Spotify connection.')}`);
      res.redirect(`${clientOrigin}/?connected=${pending.slot}`);
    });
  } catch (error) {
    console.warn('Spotify connection failed', {
      account: pending.slot,
      status: error.status,
      operation: error.spotifyPath,
      reason: error.spotifyMessage
    });
    const message = `Could not connect the ${pending.slot} Spotify account. ${error.message}`;
    res.redirect(`${clientOrigin}/?authError=${encodeURIComponent(message)}`);
  }
}));

app.post('/api/auth/disconnect/:slot', (req, res, next) => {
  if (!hasSlot(req.params.slot)) return res.status(400).json({ message: 'Unknown account slot.' });
  req.session[req.params.slot] = null;
  req.session.save((error) => error ? next(error) : res.json({ ok: true }));
});

app.get('/api/playlists', wrap(async (req, res) => {
  if (!req.session.source) throw new SpotifyError('Connect a source Spotify account first.', 401);
  const offset = Number(req.query.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    throw new SpotifyError('Invalid playlist page.', 400);
  }
  const result = await spotifyRequest(req.session.source, `/me/playlists?limit=50&offset=${offset}`);
  res.json({
    items: (result.items || [])
      .filter((item) => item && (item.owner?.id === req.session.source.user.id || item.collaborative))
      .map((item) => ({
        id: item.id,
        name: item.name,
        count: item.items?.total ?? item.tracks?.total ?? null,
        owner: item.owner?.display_name || item.owner?.id || 'Spotify',
        url: item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`
      })),
    nextOffset: result.next ? offset + (result.items?.length || 50) : null,
    total: result.total || 0
  });
}));

app.post('/api/transfer', wrap(async (req, res) => {
  const { playlistId, name, useSecondAccount } = req.body || {};
  if (!req.session.source) throw new SpotifyError('Connect a source Spotify account first.', 401);
  if (typeof name !== 'string') throw new SpotifyError('Enter a playlist name.', 400);
  if (typeof useSecondAccount !== 'boolean') throw new SpotifyError('Choose the destination account.', 400);
  const destinationAccount = useSecondAccount ? req.session.destination : req.session.source;
  if (!destinationAccount) throw new SpotifyError('Connect a destination Spotify account first.', 401);
  const result = await transferPlaylist({
    playlistId,
    name: name.trim(),
    sourceAccount: req.session.source,
    destinationAccount,
    request: spotifyRequest
  });
  res.json(result);
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }));

const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  const sendClientDocument = clientDocument(path.join(dist, 'index.html'));
  app.get(['/', '/index.html'], sendClientDocument);
  app.use(express.static(dist, { index: false }));
  app.get('*', sendClientDocument);
}

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'Invalid JSON body.' });
  if (!(error instanceof SpotifyError)) console.error(error);
  const status = error.status >= 400 && error.status < 600 ? error.status : 500;
  res.status(status).json({ message: error instanceof SpotifyError ? error.message : 'Server error. Please try again.', ...(error.partial ? { partial: error.partial } : {}) });
});

module.exports = app;
