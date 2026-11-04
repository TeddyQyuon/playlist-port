import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { create, act } from 'react-test-renderer';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';

test('hero and workspace imports load album links and copy using the album source type', async (t) => {
  const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, plugins: [react()], server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent' });
  t.after(() => vite.close());
  const keys = ['window', 'document', 'fetch', 'sessionStorage'];
  const original = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  t.after(() => { for (const key of keys) { if (original[key] === undefined) delete globalThis[key]; else globalThis[key] = original[key]; } });
  globalThis.window = { location: { search: '', pathname: '/', hash: '' }, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: true }) };
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const text = (node) => typeof node === 'string' ? node : (node.children || []).map(text).join('');
  const id = '7kFyd5oyJdVX2pIi6P4iHE';
  const url = `https://open.spotify.com/album/${id}?si=share&utm_source=copy-link`;
  const album = { id: `album-${id}`, sourceId: id, sourceType: 'album', name: 'Imported Album', count: 2, owner: 'Artist', isOwner: false, canCopy: true };
  for (const entry of ['hero', 'workspace', 'pending']) {
    const values = new Map(entry === 'pending' ? [['playlist-port.pending-source', url]] : [['playlist-port.selected', 'seed']]);
    globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    const copies = [];
    let reads = 0;
    globalThis.fetch = async (path, options = {}) => {
      if (path === '/api/session') return Response.json({ configured: true, source: { id: 'source', name: 'Listener' } });
      if (path.startsWith('/api/playlists')) return Response.json({ items: [], total: 0, nextOffset: null });
      if (path === `/api/album/${id}`) { reads++; return Response.json(album); }
      assert.equal(path, '/api/transfer');
      copies.push(JSON.parse(options.body));
      return Response.json({ name: 'Album (copy)', copied: 2, skipped: 0, total: 2, verified: true, url: 'https://open.spotify.com/playlist/copy123' });
    };
    let renderer;
    try {
      await act(async () => { renderer = create(createElement(App)); });
      const button = (pattern) => renderer.root.findAllByType('button').find((node) => pattern.test(text(node).trim()));
      if (entry !== 'pending') await act(async () => button(/^Select none$/).props.onClick());
      if (entry === 'hero') {
        const input = renderer.root.findByProps({ 'aria-label': 'Paste Spotify playlist or album URL' });
        await act(async () => input.props.onChange({ target: { value: url } }));
        const form = renderer.root.findAllByType('form').find((node) => node.props.className === 'hero-quick-form');
        await act(async () => form.props.onSubmit({ preventDefault() {} }));
      } else if (entry === 'workspace') {
        const search = renderer.root.findByProps({ id: 'playlist-search' });
        await act(async () => search.props.onChange({ target: { value: url } }));
        assert.match(text(renderer.toJSON()), /Spotify album link/);
        assert.doesNotMatch(text(renderer.toJSON()), /No loaded playlists match/);
        await act(async () => { await button(/^Load album$/).props.onClick({ preventDefault() {} }); });
      }
      assert.equal(reads, 1);
      assert.equal(copies.length, 0, 'loading a link must not create playlists');
      assert.match(text(renderer.toJSON()), /Album loaded: Imported Album/);
      assert.equal(values.has('playlist-port.pending-source'), false);
      const search = renderer.root.findByProps({ id: 'playlist-search' });
      await act(async () => search.props.onChange({ target: { value: `https://open.spotify.com/track/${id}` } }));
      assert.match(text(renderer.toJSON()), /This Spotify link is not supported/);
      assert.doesNotMatch(text(renderer.toJSON()), /No loaded playlists match/);
      assert.equal(renderer.root.findByProps({ 'aria-label': 'Load Spotify link' }).props.disabled, true);
      await act(async () => renderer.root.findByProps({ 'aria-label': 'Refresh playlists' }).props.onClick());
      await act(async () => search.props.onChange({ target: { value: '' } }));
      assert.equal(renderer.root.findAllByType('button').filter((node) => node.props.className === 'playlist-select' && node.props.title === album.name).length, 1, 'a library refresh retains imported albums');
      await act(async () => search.props.onChange({ target: { value: url } }));
      await act(async () => { await button(/^Load album$/).props.onClick({ preventDefault() {} }); });
      assert.equal(renderer.root.findAllByType('button').filter((node) => node.props.className === 'playlist-select' && node.props.title === album.name).length, 1);
      const start = button(/^Copy Playlist Now$/);
      assert.equal(Boolean(start.props.disabled), false, 'loading the same album twice keeps it selected');
      await act(async () => { await start.props.onClick(); });
      assert.equal(copies.length, 1);
      assert.equal(copies[0].sourceType, 'album');
      assert.equal(copies[0].playlistId, id);
      assert.match(text(renderer.toJSON()), /Playlists copied successfully/);
    } finally { if (renderer) await act(async () => renderer.unmount()); }
  }
});
