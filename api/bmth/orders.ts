import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "../_lib/admin-auth.js";
import { createAdminSupabase, DELIVERED_STATUSES, PAID_STATUSES } from "../_lib/admin-db.js";

const PAGE_SIZE = 20;

function qstr(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");

  if (!requireSession(req)) return res.status(401).json({ error: "Não autenticado" });

  const filter = qstr(req.query.filter) || "all";
  const search = qstr(req.query.search).trim();
  const page = Math.max(1, parseInt(qstr(req.query.page) || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  try {
    const supabase = createAdminSupabase();
    let query = supabase
      .from("orders")
      .select("id, created_at, phone, amount, label, purchased_styles, order_status, paid_at, mp_payment_id", {
        count: "exact",
      });

    // Filtros operacionais
    if (filter === "pending") {
      query = query.eq("order_status", "payment_pending");
    } else if (filter === "paid") {
      // Pagos e ainda não entregues
      const paidNotDelivered = PAID_STATUSES.filter((s) => !DELIVERED_STATUSES.includes(s));
      query = query.in("order_status", paidNotDelivered);
    } else if (filter === "delivered") {
      query = query.in("order_status", DELIVERED_STATUSES);
    }

    // Busca por telefone ou order_id (UUID completo)
    if (search) {
      const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      if (isFullUuid) {
        query = query.eq("id", search);
      } else {
        const digits = search.replace(/\D/g, "");
        query = query.ilike("phone", `%${digits || search}%`);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return res.status(200).json({
      orders: data ?? [],
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[bmth/orders]", err);
    return res.status(500).json({ error: message });
  }
}
