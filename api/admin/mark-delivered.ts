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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const body = (req.body ?? {}) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" ? body.orderId : undefined;
  if (!orderId) return res.status(400).json({ error: "Missing orderId" });

  try {
    const supabase = createSupabase();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ order_status: "delivery_sent" })
      .eq("id", orderId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: eventError } = await supabase.from("order_events").insert({
      event_type: "admin_marked_delivered",
      order_id: orderId,
      payload: { previousStatus: order.order_status },
    });

    if (eventError) {
      console.error("[mark-delivered] event insert failed", eventError);
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[admin/mark-delivered]", err);
    return res.status(500).json({ error: message });
  }
}
