export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong.');
    error.partial = data.partial;
    throw error;
  }
  return data;
}
