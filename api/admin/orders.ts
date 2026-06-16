import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function createSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function checkAuth(req: VercelRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers["authorization"];
  if (typeof auth !== "string") return false;
  return auth === `Bearer ${secret}`;
}

const PAID_STATUSES = [
  "payment_approved",
  "processing",
  "partially_completed",
  "completed",
  "delivery_pending",
  "delivery_retry_requested",
  "delivery_sent",
  "processing_failed",
  "delivery_failed",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  res.setHeader("Cache-Control", "no-store");

  try {
    const supabase = createSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, phone, amount, label, price_key, purchased_styles, selected_styles, paid_at, order_status, source_preview_path, created_at, recovery_code",
      )
      .in("order_status", PAID_STATUSES)
      .order("paid_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    return res.status(200).json({ orders: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[admin/orders]", err);
    return res.status(500).json({ error: message });
  }
}
