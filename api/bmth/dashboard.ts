import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "../_lib/admin-auth.js";
import { createAdminSupabase, startOfTodaySaoPauloISO } from "../_lib/admin-db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");

  if (!requireSession(req)) return res.status(401).json({ error: "Não autenticado" });

  try {
    const supabase = createAdminSupabase();
    const todayStart = startOfTodaySaoPauloISO();

    const [
      ordersToday,
      paymentsPending,
      paymentsApproved,
      revenueTodayRows,
      revenueTotalRows,
      recentApproved,
    ] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "payment_pending"),
      supabase.from("orders").select("id", { count: "exact", head: true }).not("paid_at", "is", null),
      supabase.from("orders").select("amount").not("paid_at", "is", null).gte("paid_at", todayStart),
      supabase.from("orders").select("amount").not("paid_at", "is", null),
      supabase
        .from("orders")
        .select("id, phone, amount, paid_at")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false })
        .limit(8),
    ]);

    const sum = (rows: { amount: null | number }[] | null) =>
      (rows ?? []).reduce((acc, r) => acc + (typeof r.amount === "number" ? r.amount : 0), 0);

    return res.status(200).json({
      ordersToday: ordersToday.count ?? 0,
      paymentsApproved: paymentsApproved.count ?? 0,
      paymentsPending: paymentsPending.count ?? 0,
      recentApproved: recentApproved.data ?? [],
      revenueToday: sum(revenueTodayRows.data as { amount: null | number }[] | null),
      revenueTotal: sum(revenueTotalRows.data as { amount: null | number }[] | null),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[bmth/dashboard]", err);
    return res.status(500).json({ error: message });
  }
}
