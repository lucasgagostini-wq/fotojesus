import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const id = req.query['id'] as string | undefined;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing env vars' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('orders')
      .select('mp_status, paid_at')
      .eq('mp_payment_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({
      status: data.mp_status as string,
      paidAt: (data.paid_at as string) ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
}
