import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "../_lib/admin-auth.js";
import { createAdminSupabase } from "../_lib/admin-db.js";
import { ORDER_SOURCE_BUCKET } from "../../src/lib/order-contract.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");

  if (!requireSession(req)) return res.status(401).json({ error: "Não autenticado" });

  const id = req.query.id;
  const orderId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
  if (!orderId) return res.status(400).json({ error: "Missing id" });

  try {
    const supabase = createAdminSupabase();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, phone, amount, label, price_key, purchased_styles, selected_styles, paid_at, order_status, source_original_path, source_preview_path, recovery_code, created_at, updated_at, mp_payment_id, mp_status, last_webhook_at",
      )
      .eq("id", orderId)
      .single();

    if (error || !order) return res.status(404).json({ error: "Pedido não encontrado" });

    let sourcePreviewUrl: null | string = null;
    const previewPath = order.source_preview_path ?? order.source_original_path;
    if (previewPath) {
      const { data: urlData } = await supabase.storage
        .from(ORDER_SOURCE_BUCKET)
        .createSignedUrl(previewPath, 60 * 60 * 4);
      sourcePreviewUrl = urlData?.signedUrl ?? null;
    }

    return res.status(200).json({ order, sourcePreviewUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[bmth/order]", err);
    return res.status(500).json({ error: message });
  }
}
