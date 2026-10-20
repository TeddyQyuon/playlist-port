const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '../../client/public');
const indexFile = path.resolve(__dirname, '../../client/index.html');

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${path.basename(file)} must be a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('SEO, social, and install metadata point at real assets', () => {
  const html = fs.readFileSync(indexFile, 'utf8');
  for (const name of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml']) {
    assert.ok(fs.existsSync(path.join(publicDir, name)), `${name} must exist in client/public`);
  }

  assert.match(html, /<link rel="canonical" href="https:\/\/playlist-port-nine\.vercel\.app\/"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/playlist-port-nine\.vercel\.app\/og-image\.png"/);
  assert.match(html, /<meta property="og:image:width" content="1200"/);
  assert.match(html, /<meta property="og:image:height" content="630"/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);

  assert.deepEqual(pngSize(path.join(publicDir, 'og-image.png')), { width: 1200, height: 630 });
  assert.deepEqual(pngSize(path.join(publicDir, 'apple-touch-icon.png')), { width: 180, height: 180 });
  assert.ok(fs.statSync(path.join(publicDir, 'og-image.png')).size < 1_000_000, 'social preview must stay lightweight');
});

test('web app manifest, robots, and sitemap stay consistent', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Playlist Port');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#08090c');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) {
    const file = path.join(publicDir, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), `${icon.src} must exist`);
    assert.equal(icon.type, 'image/png');
    const { width, height } = pngSize(file);
    assert.equal(`${width}x${height}`, icon.sizes);
  }

  const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/playlist-port-nine\.vercel\.app\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/playlist-port-nine\.vercel\.app\/<\/loc>/);
});
