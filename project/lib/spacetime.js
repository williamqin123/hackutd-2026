const database = process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE || 'flood-db';
export const TOKEN_KEY = 'flood-developer-token';

// Spacetime's HTTP wire format uses snake_case object fields.
export function encodeArguments(value) {
  if (Array.isArray(value)) return value.map(encodeArguments);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), encodeArguments(item),
    ]),
  );
  return value;
}

export function getDeveloperToken() {
  return typeof window === 'undefined' ? '' : sessionStorage.getItem(TOKEN_KEY) || '';
}

// All callers use the same-origin proxy. No generated bindings are needed.
export async function callSpacetime(name, args = [], { signal, developer = false } = {}) {
  const token = developer ? getDeveloperToken() : '';
  if (developer && !token) throw new Error('Enter your authorized Spacetime token first.');
  const response = await fetch(`/v1/database/${encodeURIComponent(database)}/call/${name}`, {
    method: 'POST', signal, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(encodeArguments(args)),
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Developer token is invalid or unauthorized.');
    throw new Error(`Spacetime request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!text.trim()) return null;
  const value = JSON.parse(text);
  const decoded = typeof value === 'string' ? JSON.parse(value) : value;
  if (decoded?.error) throw new Error(decoded.error);
  return decoded;
}
