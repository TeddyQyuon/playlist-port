import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { create, act } from 'react-test-renderer';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';

test('large transfer queues stay collapsed, searchable and paginated as results arrive', async (t) => {
  const vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    plugins: [react()], server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent'
  });
  t.after(() => vite.close());
  const { default: Progress } = await vite.ssrLoadModule('/src/TransferProgress.jsx');
  const text = (node) => typeof node === 'string' ? node : (node.children || []).map(text).join('');
  const playlists = Array.from({ length: 60 }, (_, index) => ({ id: `pl-${index}`, name: `Playlist ${index + 1}`, count: index === 0 ? null : 100 }));
  let cancelled = 0;
  const props = { playlists, activeIndex: 2, results: [{ status: 'skipped', message: 'This playlist is empty. No copy was created.' }, { copied: 100, verified: true }], elapsed: 65, destination: 'Test listener', onCancel: () => { cancelled++; } };
  let renderer;
  await act(async () => { renderer = create(createElement(Progress, props)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const buttons = () => renderer.root.findAllByType('button');
  const button = (pattern) => buttons().find((node) => pattern.test(text(node)));
  const rows = () => renderer.root.findAllByType('li');
  assert.equal(rows().length, 0, 'a long queue must not add rows until expanded');
  assert.match(text(renderer.toJSON()), /2 of 60 playlists processed/);
  assert.match(text(renderer.toJSON()), /100 tracks copiedElapsed 1:05/);
  await act(async () => button(/^View playlist queue/).props.onClick());
  assert.equal(rows().length, 6);
  assert.match(text(rows()[0]), /Skipped/);
  assert.match(text(rows()[1]), /100 tracks copied · Verified/);
  await act(async () => buttons().find((n) => n.props['aria-label'] === 'Next queue page').props.onClick());
  assert.match(text(rows()[0]), /Playlist 7/);
  const search = renderer.root.findByType('input');
  await act(async () => search.props.onChange({ target: { value: 'Playlist 60' } }));
  assert.equal(rows().length, 1);
  assert.match(text(rows()[0]), /Playlist 60/);
  await act(async () => search.props.onChange({ target: { value: '' } }));
  await act(async () => button(/^Skipped /).props.onClick());
  assert.equal(rows().length, 1);
  assert.match(text(rows()[0]), /No copy was created/);
  await act(async () => button(/^Queued /).props.onClick());
  for (let i = 0; i < 9; i++) await act(async () => buttons().find((n) => n.props['aria-label'] === 'Next queue page').props.onClick());
  assert.match(text(renderer.toJSON()), /Page 10 of 10/);
  const completed = playlists.slice(0, 59).map(() => ({ copied: 100, verified: true }));
  await act(async () => renderer.update(createElement(Progress, { ...props, activeIndex: 59, results: completed })));
  assert.equal(rows().length, 0);
  assert.match(text(renderer.toJSON()), /No queued playlists yet/);
  assert.match(text(renderer.toJSON()), /Page 1 of 1/);
  await act(async () => button(/^Cancel transfer$/).props.onClick());
  assert.equal(cancelled, 1);
  await act(async () => renderer.update(createElement(Progress, { ...props, cancelRequested: true })));
  assert.equal(button(/^Stopping/).props.disabled, true);
  await act(async () => button(/^Hide playlist queue/).props.onClick());
  assert.equal(rows().length, 0);
});
