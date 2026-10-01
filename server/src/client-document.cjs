const path = require('node:path');

function clientDocument(indexFile) {
  return (req, res) => {
    // A missing script or stylesheet must not receive the SPA document.
    if (path.extname(req.path) && req.path !== '/index.html') {
      return res.status(404).set('Cache-Control', 'no-store').type('text').send('Asset not found.');
    }
    // Vercel normalizes file timestamps. Same-sized builds can therefore share
    // a filesystem ETag even when their Vite bundle filenames have changed.
    return res.sendFile(indexFile, {
      etag: false,
      lastModified: false,
      cacheControl: false,
      headers: { 'Cache-Control': 'no-store' }
    });
  };
}

module.exports = { clientDocument };
