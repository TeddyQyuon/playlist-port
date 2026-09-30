import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { readSessionItem, removeSessionItem, writeSessionItem } from '../src/storage.js';

function storageFixture(t, descriptor) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, ...descriptor });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else delete globalThis.sessionStorage;
  });
}

test('saved playlist preferences work when browser storage is available', (t) => {
  const values = new Map();
  storageFixture(t, { value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  } });
  assert.equal(readSessionItem('playlist-port.selected'), '');
  writeSessionItem('playlist-port.selected', 'playlist123');
  assert.equal(readSessionItem('playlist-port.selected'), 'playlist123');
  removeSessionItem('playlist-port.selected');
  assert.equal(readSessionItem('playlist-port.selected'), '');
});

test('the complete app renders when the browser blocks access to sessionStorage', async (t) => {
  storageFixture(t, { get() { throw new DOMException('Storage is blocked', 'SecurityError'); } });
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
  assert.match(markup, /Move your playlists/);
  assert.match(markup, /Connect your account/);
  assert.match(markup, /Same Spotify account/);
  assert.doesNotThrow(() => writeSessionItem('playlist-port.name', 'Private copy'));
  assert.doesNotThrow(() => removeSessionItem('playlist-port.selected'));
});

test('a browser that denies storage operations uses default preferences', (t) => {
  const blocked = () => { throw new DOMException('Storage is blocked', 'SecurityError'); };
  storageFixture(t, { value: { getItem: blocked, setItem: blocked, removeItem: blocked } });
  assert.equal(readSessionItem('playlist-port.second', 'false'), 'false');
  assert.doesNotThrow(() => writeSessionItem('playlist-port.second', 'true'));
  assert.doesNotThrow(() => removeSessionItem('playlist-port.selected'));
});

test('full storage does not break a selection change or disconnect', (t) => {
  storageFixture(t, { value: {
    getItem: () => 'Previous selection',
    setItem() { throw new DOMException('Storage is full', 'QuotaExceededError'); },
    removeItem() { throw new DOMException('Storage is blocked', 'SecurityError'); }
  } });
  assert.equal(readSessionItem('playlist-port.name'), 'Previous selection');
  assert.doesNotThrow(() => writeSessionItem('playlist-port.name', 'New selection'));
  assert.doesNotThrow(() => removeSessionItem('playlist-port.selected'));
});
