// This file has been replaced by auth/google.ts, auth/me.ts, and auth/logout.ts.
// Keeping only a re-export for backward compatibility during transition.
// In production, Cloudflare Pages routes /api/auth/me → me.ts, /api/auth/google → google.ts, /api/auth/logout → logout.ts.
export { onRequestGet } from './me';
export { onRequestPost } from './logout';
