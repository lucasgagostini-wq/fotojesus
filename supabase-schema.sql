-- FotoJesus — tabela de pedidos
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS orders (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone            text        NOT NULL,
  amount           numeric(10, 2) NOT NULL,
  label            text        NOT NULL,
  price_key        text        NOT NULL DEFAULT 'single',
  styles           jsonb       NOT NULL DEFAULT '[]',
  selected_styles  jsonb       NOT NULL DEFAULT '[]',
  status_token     text        NOT NULL,
  mp_payment_id    text        UNIQUE,
  mp_status        text        NOT NULL DEFAULT 'pending',
  pix_code         text,
  pix_qr_base64    text,
  created_at       timestamptz DEFAULT now(),
  paid_at          timestamptz
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_key text NOT NULL DEFAULT 'single';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_styles jsonb NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_token text;

UPDATE orders
SET
  selected_styles = COALESCE(selected_styles, styles, '[]'::jsonb),
  status_token = COALESCE(status_token, replace(gen_random_uuid()::text, '-', ''))
WHERE selected_styles IS NULL OR status_token IS NULL;

ALTER TABLE orders ALTER COLUMN styles SET DEFAULT '[]';
ALTER TABLE orders ALTER COLUMN styles SET NOT NULL;
ALTER TABLE orders ALTER COLUMN selected_styles SET DEFAULT '[]';
ALTER TABLE orders ALTER COLUMN selected_styles SET NOT NULL;
ALTER TABLE orders ALTER COLUMN status_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON orders (mp_payment_id);
CREATE INDEX IF NOT EXISTS orders_status_token_idx ON orders (status_token);

-- Desabilita RLS (as API routes usam service_role key)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
