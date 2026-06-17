-- FotoJesus - base definitiva de pedidos, resultados e entrega
-- Execute no Supabase SQL Editor (Dashboard -> SQL Editor -> New query)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token                text NOT NULL UNIQUE,
  recovery_code               text NOT NULL,
  order_status                text NOT NULL DEFAULT 'draft',
  phone                       text,
  amount                      numeric(10, 2),
  label                       text,
  price_key                   text,
  styles                      jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_styles             jsonb NOT NULL DEFAULT '[]'::jsonb,
  purchased_styles            jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_bucket               text,
  source_original_path        text,
  source_preview_path         text,
  source_mime_type            text,
  source_sha256               text,
  source_uploaded_at          timestamptz,
  payment_provider            text NOT NULL DEFAULT 'mercado_pago',
  payment_requested_at        timestamptz,
  mp_payment_id               text UNIQUE,
  mp_status                   text NOT NULL DEFAULT 'pending',
  pix_code                    text,
  qr_base64                   text,
  paid_at                     timestamptz,
  processing_requested_at     timestamptz,
  processing_started_at       timestamptz,
  processing_completed_at     timestamptz,
  delivery_channel_preference text NOT NULL DEFAULT 'whatsapp',
  last_accessed_at            timestamptz,
  last_recovered_at           timestamptz,
  last_webhook_at             timestamptz,
  last_error                  text,
  source                      text,
  email                       text,
  created_at                  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at                  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recovery_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'draft';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_key text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_styles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchased_styles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_bucket text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_original_path text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_preview_path text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_mime_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_sha256 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_uploaded_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'mercado_pago';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_requested_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_token text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qr_base64 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_base64 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_requested_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_channel_preference text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_recovered_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE orders ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN label DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN price_key DROP NOT NULL;

UPDATE orders
SET
  access_token = COALESCE(access_token, status_token, replace(gen_random_uuid()::text, '-', '')),
  recovery_code = COALESCE(recovery_code, LPAD((FLOOR(random() * 100000000))::bigint::text, 8, '0')),
  selected_styles = COALESCE(selected_styles, styles, '[]'::jsonb),
  purchased_styles = COALESCE(purchased_styles, styles, selected_styles, '[]'::jsonb),
  styles = COALESCE(styles, purchased_styles, selected_styles, '[]'::jsonb),
  qr_base64 = COALESCE(qr_base64, pix_qr_base64),
  payment_provider = COALESCE(payment_provider, 'mercado_pago'),
  delivery_channel_preference = COALESCE(delivery_channel_preference, 'whatsapp'),
  order_status = CASE
    WHEN order_status IS NOT NULL AND order_status <> '' THEN order_status
    WHEN COALESCE(mp_status, 'pending') = 'approved' THEN 'payment_approved'
    WHEN source_original_path IS NOT NULL THEN 'photo_uploaded'
    ELSE 'draft'
  END,
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE
  access_token IS NULL
  OR recovery_code IS NULL
  OR purchased_styles IS NULL
  OR selected_styles IS NULL
  OR styles IS NULL
  OR qr_base64 IS NULL
  OR payment_provider IS NULL
  OR delivery_channel_preference IS NULL
  OR order_status IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE orders ALTER COLUMN access_token SET NOT NULL;
ALTER TABLE orders ALTER COLUMN recovery_code SET NOT NULL;
ALTER TABLE orders ALTER COLUMN order_status SET NOT NULL;
ALTER TABLE orders ALTER COLUMN styles SET DEFAULT '[]'::jsonb;
ALTER TABLE orders ALTER COLUMN styles SET NOT NULL;
ALTER TABLE orders ALTER COLUMN selected_styles SET DEFAULT '[]'::jsonb;
ALTER TABLE orders ALTER COLUMN selected_styles SET NOT NULL;
ALTER TABLE orders ALTER COLUMN purchased_styles SET DEFAULT '[]'::jsonb;
ALTER TABLE orders ALTER COLUMN purchased_styles SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_access_token_idx ON orders (access_token);
CREATE INDEX IF NOT EXISTS orders_recovery_lookup_idx ON orders (phone, recovery_code);
CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON orders (mp_payment_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (order_status);

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS order_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  style_id            integer NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  result_bucket       text NOT NULL DEFAULT 'fotojesus-order-results',
  result_path         text,
  preview_path        text,
  generation_attempts integer NOT NULL DEFAULT 0,
  processing_started_at timestamptz,
  completed_at        timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(order_id, style_id)
);

ALTER TABLE order_results ADD COLUMN IF NOT EXISTS result_bucket text NOT NULL DEFAULT 'fotojesus-order-results';
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS preview_path text;
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS generation_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE order_results ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS order_results_order_status_idx ON order_results (order_id, status);

DROP TRIGGER IF EXISTS order_results_set_updated_at ON order_results;
CREATE TRIGGER order_results_set_updated_at
BEFORE UPDATE ON order_results
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS order_deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel             text NOT NULL,
  destination         text,
  dedupe_key          text NOT NULL UNIQUE,
  status              text NOT NULL DEFAULT 'pending',
  provider            text,
  provider_message_id text UNIQUE,
  attempts            integer NOT NULL DEFAULT 0,
  requested_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_attempt_at     timestamptz,
  sent_at             timestamptz,
  last_error          text,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(order_id, channel, destination)
);

ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE order_deliveries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

UPDATE order_deliveries
SET dedupe_key = COALESCE(dedupe_key, CONCAT(channel, ':', order_id, ':', COALESCE(destination, 'none')))
WHERE dedupe_key IS NULL;

ALTER TABLE order_deliveries ALTER COLUMN dedupe_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS order_deliveries_order_status_idx ON order_deliveries (order_id, status);

DROP TRIGGER IF EXISTS order_deliveries_set_updated_at ON order_deliveries;
CREATE TRIGGER order_deliveries_set_updated_at
BEFORE UPDATE ON order_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS order_events (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS order_events_order_created_idx ON order_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_events_type_created_idx ON order_events (event_type, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotojesus-order-source',
  'fotojesus-order-source',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotojesus-order-results',
  'fotojesus-order-results',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_events DISABLE ROW LEVEL SECURITY;

-- Estrutura de paths usada pelas APIs:
-- Source:  orders/{order_id}/source/original.jpg
-- Preview: orders/{order_id}/source/preview.jpg
-- Result:  orders/{order_id}/results/style-{style_id}/final.jpg
-- Preview: orders/{order_id}/results/style-{style_id}/preview.jpg
