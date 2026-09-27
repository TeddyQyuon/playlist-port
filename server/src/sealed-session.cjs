const crypto = require('node:crypto');

const COOKIE_NAME = 'playlist_port.session';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sealedSession(secret, secure) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  const key = crypto.createHash('sha256').update(secret).digest();

  function unseal(value) {
    try {
      const payload = Buffer.from(value, 'base64url');
      if (payload.length < 29) return {};
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
      decipher.setAuthTag(payload.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([
        decipher.update(payload.subarray(28)), decipher.final()
      ]).toString('utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) && data.expiresAt > Date.now()
        ? data.values || {}
        : {};
    } catch {
      return {};
    }
  }

  function seal(values) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ expiresAt: Date.now() + MAX_AGE_MS, values }), 'utf8'),
      cipher.final()
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  }

  return (req, res, next) => {
    const value = (req.headers.cookie || '').split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    req.session = unseal(value || '');
    let saved = JSON.stringify(req.session);

    function save(callback) {
      try {
        const current = JSON.stringify(req.session);
        const value = seal(req.session);
        if (value.length > 3800) throw new Error('Spotify session is too large for a cookie.');
        res.cookie(COOKIE_NAME, value, {
          httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE_MS
        });
        saved = current;
        callback?.(null);
      } catch (error) {
        if (callback) callback(error);
        else next(error);
      }
    }

    Object.defineProperty(req.session, 'save', { value: save, enumerable: false });
    const end = res.end;
    res.end = function (...args) {
      if (!res.headersSent && JSON.stringify(req.session) !== saved) save();
      return end.apply(this, args);
    };
    next();
  };
}

module.exports = { sealedSession };
