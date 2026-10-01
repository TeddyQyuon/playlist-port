// Keep the matching Vercel headers in vercel.json: static assets can bypass Express.
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

function securityHeaders(_req, res, next) {
  res.removeHeader('X-Powered-By');
  res.set(SECURITY_HEADERS);
  next();
}

function protectApiWrites(clientOrigin) {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // Browser writes must prove their exact origin. Cookies and SameSite alone
    // are not a substitute for this check; missing/null origins fail closed.
    if (req.headers.origin !== clientOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ message: 'Request origin was not allowed.' });
    }
    // Reject simple form/text requests before parsing a body or using a session.
    const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return res.status(415).json({ message: 'Use application/json for this request.' });
    }
    next();
  };
}

module.exports = { SECURITY_HEADERS, securityHeaders, protectApiWrites };
