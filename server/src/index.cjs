const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('./app.cjs');

const port = Number(process.env.APP_PORT) || 3001;
app.listen(port, '127.0.0.1', () => {
  console.log(`Playlist Port API: http://127.0.0.1:${port}`);
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('Spotify credentials are missing. See server/.env.example.');
  }
});
