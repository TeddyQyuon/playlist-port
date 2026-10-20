// Preferences are optional. Privacy settings and full storage must not prevent
// the app from rendering or changing the current selection.
export function readSessionItem(key, fallback = '') {
  try {
    return globalThis.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionItem(key, value) {
  try {
    globalThis.sessionStorage.setItem(key, value);
  } catch {
    // React state still holds the current value when browser storage is blocked.
  }
}

export function removeSessionItem(key) {
  try {
    globalThis.sessionStorage.removeItem(key);
  } catch {
    // Disconnecting must work even when persisted preferences are unavailable.
  }
}

// The theme is a device preference, so it survives new browser sessions.
export function readLocalItem(key, fallback = '') {
  try {
    return globalThis.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalItem(key, value) {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // A blocked or full storage area must not prevent switching themes.
  }
}
