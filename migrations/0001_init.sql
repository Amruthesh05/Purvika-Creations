-- Migration: 0001_init
-- Creates users, sessions, and products tables.
-- Seeds the first superadmin from SUPERADMIN_EMAIL.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'admin', 'superadmin')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'out_of_stock')),
  image_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Seed the first superadmin.
-- Replace the email below with your SUPERADMIN_EMAIL before running,
-- or set SUPERADMIN_EMAIL as a secret and the app will auto-promote
-- that user on first sign-in.
INSERT OR IGNORE INTO users (id, email, role, approval_status, created_at)
VALUES ('seed-superadmin', 'amrutheshkn3@gmail.com', 'superadmin', 'approved', datetime('now'));


ALTER TABLE products ADD COLUMN mrp_paise INTEGER;
ALTER TABLE products ADD COLUMN variant_label TEXT NOT NULL DEFAULT 'Size';
ALTER TABLE products ADD COLUMN variants TEXT NOT NULL DEFAULT '[]';
