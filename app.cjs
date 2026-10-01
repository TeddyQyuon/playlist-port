// Vercel detects this root entry as an Express application and runs the same
// API used locally.
const express = require('express');
const app = express();
app.disable('x-powered-by');
app.use(require('./server/src/app.cjs'));

module.exports = app;
