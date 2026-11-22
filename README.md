# Styvio — Cloudflare Pages + D1 + KV E-Commerce

A mobile-first e-commerce storefront built with React Router v7, TypeScript (strict mode), and Cloudflare Pages Functions. Uses D1 as the source of truth and KV for fast catalog reads.

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Browser / Median   │────▶│  CF Pages    │────▶│  D1 (truth)     │
│  WebView            │     │  Functions   │     │  KV (catalog    │
│                     │◀────│  /api/*      │◀────│  cache)         │
└─────────────────────┘     └──────────────┘     └─────────────────┘
```

- **D1** is the source of truth for all data (users, sessions, products).
- **KV** key `LIVE_STOREFRONT_DATA` holds a compiled array of active products. The public catalog reads KV first, falls back to D1 if the key is missing.
- **All mutations** go through `POST /api/admin/mutate`: authenticate session → verify approved admin → validate with Zod → write D1 → rebuild KV cache (with retry) → return typed result.
- **Repository pattern**: `Repository` interface with `D1KVRepository` (production) and `MockRepository` (preview/dev without bindings).

## Project Structure

```
src/
├── components/          # UI components (ProductCard, Button, Field, AdminLayout, etc.)
├── lib/
│   ├── auth/            # Session management, OAuth verification, Median bridge hook
│   ├── db/              # Repository interface + D1/KV and Mock implementations
│   ├── types.ts         # Shared TypeScript types (client + API)
│   ├── validation.ts    # Zod schemas for all mutations
│   ├── mutate-handler.ts    # Product mutation handler (auth + validate + D1 + KV)
│   ├── admin-action-handler.ts  # Admin authorization actions
│   └── api-mock-plugin.ts   # Vite dev server API mock
├── routes/              # Page components (Catalog, Login, Admin panels)
└── App.tsx              # Router setup

functions/api/           # Cloudflare Pages Functions (production API)
├── catalog/             # GET /api/catalog
├── auth/                # GET /api/auth/me, POST /api/auth/oauth, POST /api/auth/logout
└── admin/               # GET /api/admin/products, GET /api/admin/users, POST /api/admin/mutate

migrations/              # D1 migration SQL files
test/                    # Vitest tests (authorization + mutate handler)
public/                  # Static assets (robots.txt, _headers)
```

## Data Model

- **users** (id, email, role, approval_status, created_at) — roles: buyer | admin | superadmin
- **sessions** (id, user_id, expires_at) — tied to signed HttpOnly cookie
- **products** (id, name, description, price_paise, stock_status, image_url, active, created_at, updated_at) — prices in integer paise, displayed in INR

## Auth

- Google OAuth and Sign in with Apple. ID tokens verified server-side.
- Median.co WebView detection via user agent / `window.median`. Uses native sign-in bridge (`useMedianAuth`) in Median; web redirects for normal browsers.
- Session: signed HttpOnly, Secure, SameSite=Lax cookie tied to sessions table.
- New users start as `buyer`. Users can request admin access (sets `approval_status` to `pending`).

## Hidden Admin (/admlogin)

- Not in sitemap, nav, footer, or any link.
- `X-Robots-Tag: noindex` via `_headers` file. Not mentioned in `robots.txt`.
- Server-side authorization enforced in Pages Functions. Non-admins get a clean 403 page.
- **Catalog Panel**: Add/Edit/Delete products with confirmation dialogs.
- **Authorization Panel**: Table of admin access requests. Superadmins can Approve, Revoke, Delete (server-enforced: cannot act on self or last superadmin).

## Deploy Steps

### 1. Create D1 Database

```bash
npx wrangler d1 create storefront-db
# Copy the database_id into wrangler.toml
```

### 2. Create KV Namespace

```bash
npx wrangler kv namespace create KV
# Copy the namespace id into wrangler.toml
```

### 3. Run Migrations

```bash
npx wrangler d1 execute storefront-db --remote --file=migrations/0001_init.sql
```

Edit the seed INSERT at the bottom of `migrations/0001_init.sql` to use your
actual superadmin email before running, or set `SUPERADMIN_EMAIL` as a secret
and the app will auto-promote that user on first sign-in.

### 4. Set Secrets

```bash
npx wrangler pages secret put SUPERADMIN_EMAIL
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put APPLE_CLIENT_ID
npx wrangler pages secret put SESSION_SECRET
```

### 5. Build and Deploy

**Option A — Connect GitHub to Cloudflare Pages (recommended):**

1. Push this repository to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Select your GitHub repository.
4. Set the build command to `npm run build` and the output directory to `dist`.
5. Under **Environment variables**, add the secrets from step 4 plus `SUPERADMIN_EMAIL`.
6. Cloudflare will automatically deploy on every push to your main branch.

**Option B — Deploy with Wrangler CLI:**

```bash
npm run build
npx wrangler pages deploy dist
```

### 6. Seed Superadmin

Set `SUPERADMIN_EMAIL` to the email of the first superadmin. When that user signs in for the first time, they will automatically be promoted to `superadmin` with `approved` status.

## Development

```bash
npm run dev        # Start dev server with mock API
npm run build      # Production build
npm run typecheck  # TypeScript strict check
npm run test       # Run vitest tests
```

The dev server uses `MockRepository` (in-memory) with seeded demo data. All API endpoints work identically to production via the Vite API mock plugin.
