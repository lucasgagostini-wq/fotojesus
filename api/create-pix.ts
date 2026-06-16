import type { VercelRequest, VercelResponse } from '@vercel/node';
import MercadoPagoConfig, { Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, label, phoneNumber, styles } = (req.body ?? {}) as {
    amount?: number;
    label?: string;
    phoneNumber?: string;
    styles?: number[];
  };

  if (!amount || !phoneNumber || !label) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing env vars' });
  }

  try {
    const mp = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(mp);

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: `FotoJesus - ${label}`,
        payment_method_id: 'pix',
        payer: {
          email: 'pagador@fotojesus.com.br',
          first_name: 'Cliente',
        },
      },
      requestOptions: { idempotencyKey: crypto.randomUUID() },
    });

    const pixCode = result.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const paymentId = String(result.id);

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('orders').insert({
      phone: phoneNumber,
      amount: Number(amount),
      label,
      styles: styles ?? [],
      mp_payment_id: paymentId,
      mp_status: 'pending',
      pix_code: pixCode,
      pix_qr_base64: qrBase64,
    });

    return res.status(200).json({ paymentId, pixCode, qrBase64 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[create-pix]', err);
    return res.status(500).json({ error: message });
  }
}
