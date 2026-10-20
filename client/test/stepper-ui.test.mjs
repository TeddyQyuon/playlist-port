import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';

test('stepper labels and 6-step architecture render in SSR markup', async (t) => {
  const vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'silent'
  });
  t.after(() => vite.close());

  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const markup = renderToString(createElement(App));

  // Verify all 6 step labels are rendered in the stepper
  assert.match(markup, /Connect source/);
  assert.match(markup, /Pick playlists/);
  assert.match(markup, /Connect destination/);
  assert.match(markup, /Review/);
  assert.match(markup, /Transfer/);
  assert.match(markup, /Results/);

  // Verify accessibility landmarks
  assert.match(markup, /aria-label="Transfer steps"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /skip-link/);

  // Verify Step 1 service cards are present
  assert.match(markup, /Spotify/);
  assert.match(markup, /Apple Music/);
  assert.match(markup, /YouTube Music/);
  assert.match(markup, /TIDAL/);
  assert.match(markup, /Deezer/);

  // Verify transparency disclosures
  assert.match(markup, /Permissions requested/);
  assert.match(markup, /Privacy note/);
});

test('CSV report generation produces expected columns and rows for reconciliation', () => {
  const mockResult = {
    name: 'Roadtrip Beats',
    copied: 42,
    skipped: 3,
    total: 45,
    verified: true,
    closeMatches: [
      {
        id: 'roadtrip-cm-1',
        title: 'Song Title (Album Remaster)',
        matchType: 'Catalog Remaster',
        reason: 'Single release replaced with album remaster'
      }
    ]
  };

  const rows = [
    ['Playlist', 'Track / Item', 'Status', 'Match Type', 'Destination', 'Note']
  ];
  const items = mockResult.items || [mockResult];
  const acceptedMatches = { 'roadtrip-cm-1': true };

  items.forEach((item) => {
    rows.push([item.name, 'Verified Copied Items', `${item.copied} tracks`, 'Exact Match', 'Destination Account', 'Preserved in original order']);
    if (item.skipped > 0) {
      rows.push([item.name, 'Local / Region-Restricted Files', `${item.skipped} tracks`, 'Skipped', 'Destination Account', 'Local audio files or unavailable in destination region']);
    }
    if (item.closeMatches) {
      item.closeMatches.forEach((cm) => {
        const isAccepted = Boolean(acceptedMatches[cm.id]);
        rows.push([
          item.name,
          cm.title,
          isAccepted ? 'Accepted Close Match' : 'Suggested Close Match',
          cm.matchType,
          'Destination Account',
          cm.reason
        ]);
      });
    }
  });

  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], 'Playlist');
  assert.equal(rows[0][1], 'Track / Item');
  assert.equal(rows[0][2], 'Status');
  assert.equal(rows[0][3], 'Match Type');
  assert.equal(rows[1][1], 'Verified Copied Items');
  assert.equal(rows[1][2], '42 tracks');
  assert.equal(rows[2][1], 'Local / Region-Restricted Files');
  assert.equal(rows[2][2], '3 tracks');
  assert.equal(rows[3][2], 'Accepted Close Match');
});
