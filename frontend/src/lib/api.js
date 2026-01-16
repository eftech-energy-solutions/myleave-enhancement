const PUBLIC_VITE_API_BASE = import.meta.env.VITE_PUBLIC_VITE_API_BASE;

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${PUBLIC_VITE_API_BASE}${path}`, {
    credentials: 'include',
    ...options
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  return res.json();
}
