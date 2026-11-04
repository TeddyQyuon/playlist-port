import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { create, act } from 'react-test-renderer';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Exercise the real React event handler and terminal screen with API fixtures.
// Spotify writes remain mocked, so the regression test never creates playlists.
test('transfer UI exits progress for empty sources, mixed queues, failures and retries', async (t) => {
  const vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    plugins: [react()], server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent'
  });
  t.after(() => vite.close());
  const originals = Object.fromEntries(['window', 'document', 'fetch', 'sessionStorage'].map((key) => [key, globalThis[key]]));
  t.after(() => { for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  } });
  globalThis.window = {
    location: { search: '', pathname: '/', hash: '' },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: true })
  };
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const text = (node) => typeof node === 'string' ? node : (node.children || []).map(text).join('');
  const hasStep = (root, step) => root.findAll((n) => n.props.className?.split(' ').includes(`step-view-${step}`)).length > 0;
  const button = (root, pattern) => root.findAllByType('button').find((n) => pattern.test(text(n).trim()));

  for (const ids of [['empty'], ['liked-songs'], ['empty', 'music'], ['music', 'empty'], ['empty', 'empty2'], ['failure']]) {
    const values = new Map([['playlist-port.selected', 'seed']]);
    globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    const calls = [];
    const playlists = ['empty', 'empty2', 'music', 'failure'].map((id) => ({ id, name: id, count: id.startsWith('empty') ? 0 : 2, owner: 'Test', isOwner: true }));
    globalThis.fetch = async (url, options = {}) => {
      if (url === '/api/session') return Response.json({ configured: true, source: { id: 'source', name: 'Test Listener' } });
      if (url.startsWith('/api/playlists')) return Response.json({ items: playlists, total: playlists.length, nextOffset: null });
      assert.equal(url, '/api/transfer');
      const { playlistId, name } = JSON.parse(options.body);
      calls.push(playlistId);
      if (playlistId === 'failure') return Response.json({ message: 'Spotify failed. Please try again.' }, { status: 502 });
      if (playlistId !== 'music') return Response.json({ code: 'EMPTY_PLAYLIST', message: 'This playlist is empty. No copy was created.' }, { status: 422 });
      return Response.json({ name, copied: 2, skipped: 0, total: 2, verified: true, url: 'https://open.spotify.com/playlist/copy123' });
    };
    let renderer;
    try {
      await act(async () => { renderer = create(createElement(App)); });
      assert.ok(hasStep(renderer.root, 2));
      for (const id of ids) {
        const name = id === 'liked-songs' ? 'Liked Songs' : id;
        const row = renderer.root.findAllByType('button').find((node) => node.props.className === 'playlist-select' && node.props.title === name);
        await act(async () => row.props.onClick());
      }
      const start = button(renderer.root, /^Copy .* Now/);
      assert.equal(Boolean(start.props.disabled), false, `${ids}: copy must be available even with an empty first playlist`);
      await act(async () => { await start.props.onClick(); });
      assert.equal(hasStep(renderer.root, 5), false, `${ids}: must leave progress`);
      assert.deepEqual(calls, ids);
      const content = text(renderer.toJSON());
      if (ids[0] === 'failure') {
        assert.ok(hasStep(renderer.root, 4));
        assert.match(content, /Spotify failed/);
        // A retry must be enabled and reach the API again: the lock was released.
        const retry = button(renderer.root, /^Copy Playlist \(/);
        assert.equal(Boolean(retry.props.disabled), false);
        await act(async () => { await retry.props.onClick(); });
        assert.deepEqual(calls, ['failure', 'failure']);
      } else {
        assert.ok(hasStep(renderer.root, 6));
        assert.match(content, /playlists? skipped/);
        assert.match(content, ids.includes('music') ? /Playlists copied successfully/ : /No playlists copied/);
      }
    } finally {
      if (renderer) await act(async () => renderer.unmount());
    }
  }
});
