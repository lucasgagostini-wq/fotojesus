import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'node:crypto';
import MercadoPagoConfig, { Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

function validateSignature(req: VercelRequest): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not configured

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (typeof xSignature !== 'string' || typeof xRequestId !== 'string') return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const idx = part.indexOf('=');
      return [part.slice(0, idx), part.slice(idx + 1)];
    }),
  );

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const dataId = (req.query['data.id'] as string) ?? (req.body as Record<string, unknown>)?.['data.id'] ?? '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  return hash === v1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!validateSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = (req.body ?? {}) as { type?: string; data?: { id?: string } };
  const { type, data } = body;

  // MP sends test/other event types — acknowledge them without processing
  if (type !== 'payment') return res.status(200).json({ ok: true });

  const paymentId = data?.id;
  if (!paymentId) return res.status(400).json({ error: 'Missing payment id' });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing env vars' });
  }

  try {
    const mp = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(mp);
    const result = await payment.get({ id: paymentId });

    const status = result.status ?? 'unknown';
    const update: Record<string, unknown> = { mp_status: status };
    if (status === 'approved') update.paid_at = new Date().toISOString();

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase
      .from('orders')
      .update(update)
      .eq('mp_payment_id', String(paymentId));

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[webhook]', err);
    return res.status(500).json({ error: message });
  }
}
