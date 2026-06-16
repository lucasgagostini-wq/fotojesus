import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { ORDER_SOURCE_BUCKET } from "../../src/lib/order-contract.js";

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
  if (req.method !== "GET") return res.status(405).end();
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const id = req.query.id;
  const orderId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
  if (!orderId) return res.status(400).json({ error: "Missing id" });

  res.setHeader("Cache-Control", "no-store");

  try {
    const supabase = createSupabase();

    const [orderResult, resultsResult, deliveriesResult, eventsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, phone, amount, label, price_key, purchased_styles, selected_styles, paid_at, order_status, source_original_path, source_preview_path, recovery_code, created_at, updated_at, mp_payment_id, mp_status, last_webhook_at",
        )
        .eq("id", orderId)
        .single(),
      supabase
        .from("order_results")
        .select("style_id, status, result_path, preview_path, completed_at, last_error")
        .eq("order_id", orderId)
        .order("style_id", { ascending: true }),
      supabase
        .from("order_deliveries")
        .select("channel, status, destination, attempts, last_attempt_at, sent_at, last_error")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("order_events")
        .select("event_type, payload, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (orderResult.error || !orderResult.data) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.data;

    let sourcePreviewUrl: null | string = null;
    if (order.source_preview_path) {
      const { data: urlData } = await supabase.storage
        .from(ORDER_SOURCE_BUCKET)
        .createSignedUrl(order.source_preview_path, 60 * 60 * 4);
      sourcePreviewUrl = urlData?.signedUrl ?? null;
    }

    let sourceOriginalUrl: null | string = null;
    if (order.source_original_path) {
      const { data: urlData } = await supabase.storage
        .from(ORDER_SOURCE_BUCKET)
        .createSignedUrl(order.source_original_path, 60 * 60 * 4);
      sourceOriginalUrl = urlData?.signedUrl ?? null;
    }

    return res.status(200).json({
      deliveries: deliveriesResult.data ?? [],
      events: eventsResult.data ?? [],
      order,
      results: resultsResult.data ?? [],
      sourceOriginalUrl,
      sourcePreviewUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[admin/order]", err);
    return res.status(500).json({ error: message });
  }
}
