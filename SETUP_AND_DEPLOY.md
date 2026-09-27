# Playlist Port: VS Code and Vercel setup

This project currently copies a Spotify playlist to a **new private playlist** in the same Spotify account or another Spotify account. Apple Music, YouTube Music, YouTube, Deezer, and TIDAL are visible as future services and are not implemented.

## 1. Open and run in VS Code

1. Extract `Playlist-Port-Full-Project.zip` and open the `playlist-port` folder in VS Code.
2. Install Node.js 20 or newer. Open **Terminal → New Terminal** in VS Code and run:

   ```bash
   npm ci
   npm test
   npm run build
   ```

3. Copy `server/.env.example` to `server/.env`:

   - Windows PowerShell: `Copy-Item server/.env.example server/.env`
   - macOS/Linux: `cp server/.env.example server/.env`

4. Edit `server/.env`. Fill these values with your own Spotify app credentials and a fresh random session secret:

   ```dotenv
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/auth/callback
   CLIENT_ORIGIN=http://127.0.0.1:5173
   SESSION_SECRET=your_random_secret_at_least_32_characters
   APP_PORT=3001
   ```

   Generate `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not put `server/.env` or the real secret in Git.

5. In your Spotify Developer Dashboard, open the **Playlist Port** app settings and add the exact local redirect URI `http://127.0.0.1:3001/api/auth/callback`. Keep the production redirect URI too. Spotify accepts HTTP for `127.0.0.1`; do not substitute `localhost`.
6. In the app's **Users Management**, add the Spotify account you will sign in with, using its Spotify account name and email. A Development Mode app needs an allowlisted account and its owner needs Spotify Premium. Add a second account too if you want to transfer between accounts.
7. Run `npm run dev`. Open `http://127.0.0.1:5173` in your browser. The terminal runs Vite and Express together. You should now be able to click **Connect**.

## 2. Deploy from this folder to your existing Vercel project

1. In Vercel, open the existing `playlist-port` project. In **Settings → Environment Variables**, set these five variables for **Production**:

   | Key | Value |
   | --- | --- |
   | `SPOTIFY_CLIENT_ID` | Your Spotify Client ID |
   | `SPOTIFY_CLIENT_SECRET` | Your Spotify Client Secret; use the Secret type |
   | `SPOTIFY_REDIRECT_URI` | `https://playlist-port-nine.vercel.app/api/auth/callback` for the existing domain |
   | `CLIENT_ORIGIN` | `https://playlist-port-nine.vercel.app` for the existing domain |
   | `SESSION_SECRET` | A fresh random value of at least 32 characters; use the Secret type |

   The two Spotify keys may already appear in that project; check the list and add the three remaining settings. If you deploy to a different permanent domain, replace the URL in both URL variables. Keep `SPOTIFY_CLIENT_SECRET` and `SESSION_SECRET` server-side in Vercel, never in a `VITE_` variable.

2. In Spotify app settings, add the matching production redirect URI. It must match `SPOTIFY_REDIRECT_URI` exactly, including `https`, host, path, and trailing-slash choice.
3. From the extracted project root in the VS Code terminal, run:

   ```bash
   npx vercel login
   npx vercel link
   npx vercel deploy --prod
   ```

   Select your Vercel account and the **existing** `playlist-port` project when prompted by `vercel link`. The final command deploys this extracted source and uses the project's Production variables. You can instead commit this source to the GitHub repository already connected to that Vercel project, then redeploy after setting the variables.

4. Open `https://playlist-port-nine.vercel.app/api/session`. It should show `"configured":true`. If it says `false`, check the three Spotify variables and redeploy; the UI will keep Connect disabled until configured.
5. Open the website, connect the allowlisted Spotify account, select a small playlist you own, choose **Same Spotify account**, and click **Copy playlist**. Open the resulting Spotify link and confirm its item order and private status. For a second account, add it to the Spotify app allowlist first, choose **Another Spotify account**, and connect it separately.

## Common errors

- **Spotify redirect mismatch:** Register the exact URI used by the current environment in Spotify app settings.
- **403 from Spotify:** Confirm the account is on the app's Development Mode allowlist, the app owner has Premium, and you own or collaborate on the source playlist.
- **Connect disabled:** `/api/session` is not configured. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`, then redeploy.
- **Session error after configuring:** Set `SESSION_SECRET` to a random string of at least 32 characters and redeploy.

The source playlist is never deleted or modified. Local or unavailable items are counted as skipped. If a later batch fails, the app displays the partial copy's Spotify link so you can inspect it before retrying.
