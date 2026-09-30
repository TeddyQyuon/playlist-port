const crypto = require('node:crypto');

const COOKIE_NAME = 'playlist_port.session';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SLOTS = ['source', 'destination', 'oauth'];

function sealedSession(secret, secure) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  const key = crypto.createHash('sha256').update(secret).digest();

  function unseal(value, slot) {
    try {
      const payload = Buffer.from(value, 'base64url');
      if (payload.length < 29 || payload.toString('base64url') !== value) return undefined;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
      if (slot) decipher.setAAD(Buffer.from(slot));
      decipher.setAuthTag(payload.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([
        decipher.update(payload.subarray(28)), decipher.final()
      ]).toString('utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) && data.expiresAt > Date.now()
        ? data.values
        : undefined;
    } catch {
      return undefined;
    }
  }

  function seal(values, slot) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(slot));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ expiresAt: Date.now() + MAX_AGE_MS, values }), 'utf8'),
      cipher.final()
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  }

  return (req, res, next) => {
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1)];
    }));
    // Migrate the original single cookie without requiring existing users to
    // reconnect. Each account now has its own cookie so two token pairs cannot
    // overflow one browser cookie or overwrite each other during refresh.
    const legacy = unseal(cookies[COOKIE_NAME] || '');
    req.session = {};
    for (const slot of SLOTS) {
      const name = `playlist_port.${slot}`;
      const value = Object.hasOwn(cookies, name)
        ? unseal(cookies[name], slot)
        : legacy?.[slot];
      if (value && typeof value === 'object' && !Array.isArray(value)) req.session[slot] = value;
    }
    let migrate = Object.hasOwn(cookies, COOKIE_NAME);
    let saved = Object.fromEntries(SLOTS.map((slot) => [slot, JSON.stringify(req.session[slot])]));
    let saveFailed = false;
    const cookieOptions = { httpOnly: true, sameSite: 'lax', secure, path: '/' };

    function persist() {
      try {
        const current = Object.fromEntries(SLOTS.map((slot) => [slot, JSON.stringify(req.session[slot])]));
        // Validate every changed cookie before sending any of them. A failed
        // destination connection must leave the existing source intact.
        const updates = SLOTS.filter((slot) => migrate || current[slot] !== saved[slot]).map((slot) => {
          const value = req.session[slot] ? seal(req.session[slot], slot) : null;
          if (value && value.length > 3800) throw new Error(`The ${slot} Spotify connection is too large to save.`);
          return { slot, value };
        });
        for (const { slot, value } of updates) {
          const name = `playlist_port.${slot}`;
          if (value) res.cookie(name, value, {
            ...cookieOptions, maxAge: slot === 'oauth' ? 10 * 60 * 1000 : MAX_AGE_MS
          });
          else res.clearCookie(name, cookieOptions);
        }
        if (migrate) res.clearCookie(COOKIE_NAME, cookieOptions);
        migrate = false;
        saved = current;
        saveFailed = false;
        return null;
      } catch (error) {
        saveFailed = true;
        return error;
      }
    }

    function save(callback) {
      const error = persist();
      if (callback) callback(error);
      else if (error) next(error);
    }

    Object.defineProperty(req.session, 'save', { value: save, enumerable: false });
    const end = res.end;
    res.end = function (...args) {
      const dirty = migrate || SLOTS.some((slot) => JSON.stringify(req.session[slot]) !== saved[slot]);
      if (!res.headersSent && !saveFailed && dirty) {
        const error = persist();
        if (error) {
          next(error);
          return this;
        }
      }
      return end.apply(this, args);
    };
    next();
  };
}

module.exports = { sealedSession };
