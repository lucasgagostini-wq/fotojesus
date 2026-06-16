import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "../_lib/admin-auth.js";
import { createAdminSupabase } from "../_lib/admin-db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = requireSession(req);
  if (!session) return res.status(401).json({ error: "Não autenticado" });

  const body = (req.body ?? {}) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" ? body.orderId : undefined;
  if (!orderId) return res.status(400).json({ error: "Missing orderId" });

  try {
    const supabase = createAdminSupabase();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) return res.status(404).json({ error: "Pedido não encontrado" });

    const { error: updateError } = await supabase
      .from("orders")
      .update({ order_status: "delivered" })
      .eq("id", orderId);

    if (updateError) throw new Error(updateError.message);

    const { error: eventError } = await supabase.from("order_events").insert({
      event_type: "admin_marked_delivered",
      order_id: orderId,
      payload: { by: session.u, panel: "BMTH", previousStatus: order.order_status },
    });

    if (eventError) console.error("[bmth/mark-delivered] event insert failed", eventError);

    return res.status(200).json({ ok: true, status: "delivered" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[bmth/mark-delivered]", err);
    return res.status(500).json({ error: message });
  }
}
