-- COD support: track payment method and handling charge
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'online';
ALTER TABLE orders ADD COLUMN cod_fee_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_collected_at TEXT;
