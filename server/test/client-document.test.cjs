const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { clientDocument } = require('../src/client-document.cjs');

const fixedTime = new Date('2018-10-20T01:46:40Z');
const oldHtml = '<script type="module" src="/assets/old.js"></script>';
const newHtml = '<script type="module" src="/assets/new.js"></script>';

function fixture(t) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-port-client-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'assets/new.js'), 'export const loaded = true;');
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  return dist;
}

function writeIndex(dist, html) {
  const file = path.join(dist, 'index.html');
  fs.writeFileSync(file, html);
  fs.utimesSync(file, fixedTime, fixedTime);
}

async function start(t, app) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return server;
}

function get(server, route, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: server.address().port, path: route, headers, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
      response.on('error', reject);
    }).on('error', reject);
  });
}

function clientApp(dist) {
  const app = express();
  const document = clientDocument(path.join(dist, 'index.html'));
  app.get(['/', '/index.html'], document);
  app.use(express.static(dist, { index: false }));
  app.get('*', document);
  return app;
}

test('same-sized deployments with normalized timestamps always return the current HTML', async t => {
  const dist = fixture(t);
  writeIndex(dist, oldHtml);
  const legacyApp = express();
  legacyApp.use(express.static(dist));
  const legacyServer = await start(t, legacyApp);
  const original = await get(legacyServer, '/');
  assert.ok(original.headers.etag);
  writeIndex(dist, newHtml);
  const stale = await get(legacyServer, '/', { 'If-None-Match': original.headers.etag });
  assert.equal(stale.status, 304, 'reproduces the stale filesystem validator');

  const server = await start(t, clientApp(dist));
  for (const route of ['/', '/index.html', '/transfer']) {
    const current = await get(server, route, {
      'If-None-Match': original.headers.etag,
      'If-Modified-Since': original.headers['last-modified']
    });
    assert.equal(current.status, 200);
    assert.equal(current.body, newHtml);
    assert.equal(current.headers['cache-control'], 'no-store');
    assert.equal(current.headers.etag, undefined);
    assert.equal(current.headers['last-modified'], undefined);
  }
});

test('removed scripts and styles return 404 instead of a successful HTML response', async t => {
  const dist = fixture(t);
  writeIndex(dist, newHtml);
  const server = await start(t, clientApp(dist));
  for (const route of ['/assets/old.js', '/assets/old.css', '/missing.svg']) {
    const response = await get(server, route);
    assert.equal(response.status, 404);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.doesNotMatch(response.headers['content-type'], /text\/html/);
    assert.doesNotMatch(response.body, /<script/);
  }
});

test('the current JavaScript bundle is still served with its correct content type', async t => {
  const dist = fixture(t);
  writeIndex(dist, newHtml);
  const server = await start(t, clientApp(dist));
  const response = await get(server, '/assets/new.js');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.equal(response.body, 'export const loaded = true;');
});
