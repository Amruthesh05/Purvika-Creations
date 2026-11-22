export const MIN_IMAGES = 2;
export const MAX_IMAGES = 6;

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f4f6"/><path d="M150 250c0-27 22-50 50-50s50 23 50 50" fill="none" stroke="#d1d5db" stroke-width="6"/><circle cx="200" cy="170" r="30" fill="#e5e7eb"/><rect x="120" y="120" width="160" height="160" fill="none" stroke="#d1d5db" stroke-width="4" rx="12"/></svg>',
  );

function parseImageList(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function normalizeImageUrls(imageUrls: unknown, fallback: string | null | undefined): string[] {
  const list = parseImageList(imageUrls);
  if (Array.isArray(list)) {
    const filtered = list.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    if (filtered.length > 0) return filtered;
  }
  if (typeof fallback === 'string' && fallback.trim().length > 0) return [fallback];
  return [];
}
