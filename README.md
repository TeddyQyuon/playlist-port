# Playlist Port

A React + Express playlist transfer app. The first release copies Spotify playlists to the same Spotify account or to a second Spotify account. It creates a **new playlist hidden from the destination's public profile** and leaves the original untouched.

## What it does

1. Connect your source Spotify account.
2. Pick a playlist you own or collaborate on.
3. Choose the same account or connect another Spotify account as the destination.
4. Name the copy and transfer its tracks and episodes in their original order.
5. Open the new playlist in Spotify. The result shows any unavailable or local items that could not be copied. Choose **Make private** in Spotify if you want to restrict access through its link.

The client uses React, Vite, plain JavaScript, CSS, and React Icons. The server uses Node.js and Express. OAuth credentials and access tokens stay in the server session; the browser receives only account names and playlist details. This first release has no database or transfer history.

## Spotify developer setup

Spotify's **Development Mode** requires the developer account to have Spotify Premium and currently limits a new app to five authorized users. Add both Spotify accounts to the app's user allowlist if you want to transfer between two accounts. The account authorizing the app must be able to access the playlists it selects. A public URL does not remove Spotify's development-user limit.

1. Create an app at [Spotify for Developers](https://developer.spotify.com/dashboard). Copy its **Client ID** and **Client Secret**.
2. In the Spotify app settings, register this exact redirect URI:

   ```text
   http://127.0.0.1:3001/api/auth/callback
   ```

   Spotify no longer accepts `localhost` as an HTTP redirect alias. Use `127.0.0.1` everywhere locally.
3. Copy `server/.env.example` to `server/.env`. Fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. Replace `SESSION_SECRET` with a random string of at least 32 characters. Keep `.env` private.
4. From the project root, run:

   ```bash
   npm install
   npm run dev
   ```

5. Open **http://127.0.0.1:5173**. Connect the source account. To use another account as the destination, select that option and connect it separately in the Spotify consent page.

`npm run build` builds the React client. To use `npm start` to serve the built client and API on `http://127.0.0.1:3001`, first set `CLIENT_ORIGIN=http://127.0.0.1:3001` in `server/.env`. Restore `CLIENT_ORIGIN=http://127.0.0.1:5173` when using `npm run dev`. Keep the Spotify callback on port 3001 in either mode. `npm test` checks playlist pagination, order, batching, and partial failures with mocked Spotify responses.

## Current Spotify API behavior

This app uses Spotify's 2026 playlist routes: `GET /playlists/{id}/items`, `POST /me/playlists`, and `POST /playlists/{id}/items`. Spotify permits item reads for playlists owned by or collaborative with the signed-in user. It cannot copy local files or removed items; those appear in the skipped count. The app copies metadata references to Spotify items, never audio files.

The app creates copies with `public: false`. This keeps them off the user's public profile and out of search results; it does **not** restrict access through the playlist link. Spotify's Web API cannot change playlist access control. Use **Make private** in Spotify to restrict access. See [Spotify's playlist status documentation](https://developer.spotify.com/documentation/web-api/concepts/playlists#public-private-and-collaborative-status).

Spotify can impose rate and development quotas. If an error occurs after the destination playlist was created, the app shows a link to the partial playlist and the number of items copied. Do not press Copy again without checking it, since that would create another playlist.

## Project layout

```text
client/src/App.jsx          React flow and service picker
client/src/styles.css       Responsive visual design
server/src/app.cjs          Express routes, OAuth, session
server/src/spotify.cjs      Spotify token and API calls
server/src/transfer.cjs     Playlist pagination and copy logic
server/test/                Mocked transfer tests
```

## Deploy to Vercel

The root `app.cjs` exports the Express API as one Vercel Function. `npm run build` puts the Vite frontend in the root `public/` directory for Vercel's CDN. The server uses AES-GCM encrypted, HttpOnly cookies for Spotify connections so sessions survive across Vercel function instances; only the server can read their contents.

1. Import this repository into Vercel. Keep its root directory at the repository root. The `vercel.json` file selects Express and runs `npm run build`.
2. Add **Production** environment variables `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `CLIENT_ORIGIN` and `SESSION_SECRET`. Use the permanent production domain for `CLIENT_ORIGIN`, for example `https://playlist-port.vercel.app`. Set `SPOTIFY_REDIRECT_URI` to that same origin plus `/api/auth/callback`. Generate a unique random `SESSION_SECRET` of at least 32 characters. Never add these values to Git.
3. Register that **exact** HTTPS redirect URI in the Spotify Developer Dashboard and allowlist each Spotify account that will use the app. Redeploy after changing Vercel environment variables.
4. Check `/api/health`, `/api/session` (which must report `configured: true`), then connect an allowlisted Spotify account and copy a small test playlist before sharing the demo link.

Vercel Preview URLs are different from the production domain, so this setup authorizes the permanent production URL only. The app uses no database; encrypted session cookies expire after 24 hours. The encrypted cookie is never accessible to client JavaScript, but users should still disconnect when using a shared computer.
