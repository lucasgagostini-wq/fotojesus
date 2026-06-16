-- FotoJesus — tabela de pedidos
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS orders (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone            text        NOT NULL,
  amount           numeric(10, 2) NOT NULL,
  label            text        NOT NULL,
  styles           jsonb       DEFAULT '[]',
  mp_payment_id    text        UNIQUE,
  mp_status        text        NOT NULL DEFAULT 'pending',
  pix_code         text,
  pix_qr_base64    text,
  created_at       timestamptz DEFAULT now(),
  paid_at          timestamptz
);

-- Índice para lookup rápido por payment id (usado pelo webhook e polling)
CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON orders (mp_payment_id);

-- Desabilita RLS (as API routes usam service_role key)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
