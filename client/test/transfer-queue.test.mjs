import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transferQueue } from '../src/transfer-queue.js';
import { api } from '../src/api.js';

const empty = (code = 'EMPTY_PLAYLIST') => Object.assign(new Error('No copy was created.'), { status: 422, code });

function run(playlists, transfer, overrides = {}) {
  return transferQueue({ playlists: playlists.map((id) => ({ id, name: id })), transfer,
    onActive() {}, onResult() {}, shouldCancel: () => false, ...overrides });
}

test('empty sources at any position do not stop later playlists or misalign progress', async () => {
  const updates = [];
  const calls = [];
  const outcome = await run(['empty-first', 'music', 'empty-middle', 'more-music', 'empty-last'], async ({ id }) => {
    calls.push(id);
    if (id.startsWith('empty')) throw empty();
    return { name: id, copied: 2, verified: true, url: `https://open.spotify.com/playlist/${id}` };
  }, { onResult: (results) => updates.push(results) });
  assert.deepEqual(calls, ['empty-first', 'music', 'empty-middle', 'more-music', 'empty-last']);
  assert.deepEqual(outcome.completed.map((r) => r.name), ['music', 'more-music']);
  assert.equal(outcome.skipped.length, 3);
  assert.equal(outcome.error, null);
  assert.deepEqual(updates.at(-1).map((r) => r.status || 'copied'), ['skipped', 'copied', 'skipped', 'copied', 'skipped']);
});

test('empty Liked Songs and sources with only unavailable items finish without fabricated copies', async () => {
  const outcome = await run(['liked-songs', 'local-only'], async ({ id }) => {
    throw empty(id === 'liked-songs' ? 'EMPTY_PLAYLIST' : 'NO_TRANSFERABLE_ITEMS');
  });
  assert.equal(outcome.completed.length, 0);
  assert.equal(outcome.skipped.length, 2);
  assert.equal(outcome.error, null);
});

test('real failures stop the queue and retain both earlier copies and partial writes', async () => {
  const partial = { name: 'partial', copied: 1, total: 2, url: 'https://open.spotify.com/playlist/partial' };
  const failure = Object.assign(new Error('Spotify failed.'), { status: 502, partial });
  const calls = [];
  const outcome = await run(['music', 'partial', 'untouched'], async ({ id }) => {
    calls.push(id);
    if (id === 'partial') throw failure;
    return { name: id, copied: 2, verified: true };
  });
  assert.deepEqual(calls, ['music', 'partial']);
  assert.equal(outcome.completed.length, 1);
  assert.equal(outcome.error, failure);
  assert.equal(outcome.error.partial, partial);
});

test('unknown validation errors are not mistaken for empty playlists', async () => {
  const failure = Object.assign(new Error('Invalid request.'), { status: 422 });
  const outcome = await run(['invalid'], async () => { throw failure; });
  assert.equal(outcome.error, failure);
  assert.equal(outcome.skipped.length, 0);
});

test('cancelling after an empty source prevents the next request', async () => {
  let cancelled = false;
  const calls = [];
  const outcome = await run(['empty', 'untouched'], async ({ id }) => {
    calls.push(id);
    throw empty();
  }, { shouldCancel: () => cancelled, onResult: () => { cancelled = true; } });
  assert.deepEqual(calls, ['empty']);
  assert.equal(outcome.cancelled, true);
});

test('API preserves the machine-readable empty-playlist response for the queue', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'This playlist is empty.', code: 'EMPTY_PLAYLIST' }), { status: 422 });
  await assert.rejects(api('/transfer', { method: 'POST' }), (error) =>
    error.status === 422 && error.code === 'EMPTY_PLAYLIST' && error.message === 'This playlist is empty.');
});
