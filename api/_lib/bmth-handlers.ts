import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearSessionCookie,
  createSessionToken,
  getAdminCredentials,
  requireSession,
  setSessionCookie,
  validateCredentials,
} from "./admin-auth.js";
import {
  createAdminSupabase,
  DELIVERED_STATUSES,
  PAID_STATUSES,
  startOfTodaySaoPauloISO,
} from "./admin-db.js";
import { ORDER_RESULTS_BUCKET, ORDER_SOURCE_BUCKET } from "../../src/lib/order-contract.js";
import { sendTest as discordSendTest } from "./discord.js";

const PAGE_SIZE = 20;

function qstr(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

// ─────────────────────────────── login ────────────────────────────────────────

export async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!getAdminCredentials()) {
    return res
      .status(500)
      .json({ error: "Painel não configurado (ADMIN_USERNAME/ADMIN_PASSWORD ausentes)" });
  }

  const body = (req.body ?? {}) as { password?: unknown; username?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  if (!validateCredentials(username, password)) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = createSessionToken(username);
  if (!token) return res.status(500).json({ error: "Falha ao criar sessão" });

  setSessionCookie(req, res, token);
  return res.status(200).json({ ok: true, username });
}

export async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  clearSessionCookie(req, res);
  return res.status(200).json({ ok: true });
}

export async function handleSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");
  const session = requireSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, username: session.u });
}

// ───────────────────────────────── dashboard ──────────────────────────────────

export async function handleDashboard(req: VercelRequest, res: VercelResponse) {
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

// ─────────────────────────────── lista de pedidos ─────────────────────────────

export async function handleOrders(req: VercelRequest, res: VercelResponse) {
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
      .select(
        "id, created_at, phone, email, amount, label, purchased_styles, order_status, paid_at, mp_payment_id, source",
        { count: "exact" },
      );

    if (filter === "pending") {
      query = query.eq("order_status", "payment_pending");
    } else if (filter === "paid") {
      const paidNotDelivered = PAID_STATUSES.filter((s) => !DELIVERED_STATUSES.includes(s));
      query = query.in("order_status", paidNotDelivered);
    } else if (filter === "delivered") {
      query = query.in("order_status", DELIVERED_STATUSES);
    } else if (filter === "jesus") {
      query = query.eq("source", "jesus");
    } else if (filter === "aparecida") {
      query = query.eq("source", "aparecida");
    }

    if (search) {
      const isFullUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
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

// ─────────────────────────────── detalhe ──────────────────────────────────────

export async function handleOrder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");
  if (!requireSession(req)) return res.status(401).json({ error: "Não autenticado" });

  const orderId = qstr(req.query.id);
  if (!orderId) return res.status(400).json({ error: "Missing id" });

  try {
    const supabase = createAdminSupabase();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, phone, email, amount, label, price_key, purchased_styles, selected_styles, paid_at, order_status, source, source_original_path, source_preview_path, recovery_code, created_at, updated_at, mp_payment_id, mp_status, last_webhook_at",
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

// ─────────────────────────────── marcar entregue ──────────────────────────────

export async function handleMarkDelivered(req: VercelRequest, res: VercelResponse) {
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

// ─────────────────────────── comando administrativo ───────────────────────────

export async function handleAdminCmd(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = requireSession(req);
  if (!session) return res.status(401).json({ error: "Não autenticado" });

  const body = (req.body ?? {}) as { command?: unknown; orderId?: unknown };
  const command = typeof body.command === "string" ? body.command.trim() : "";

  switch (command) {
    case "reset-data": {
      try {
        const supabase = createAdminSupabase();

        // order_events.id é BIGINT GENERATED BY DEFAULT AS IDENTITY (ver supabase-schema.sql:220)
        // — gt(0) apaga todas as linhas pois IDs auto-increment começam em 1
        const { error: evErr } = await supabase
          .from("order_events")
          .delete()
          .gt("id", 0);
        if (evErr) throw new Error(`order_events: ${evErr.message}`);

        // orders.id é UUID — not("id", "is", null) apaga todas as linhas reais
        const { error: ordErr, count } = await supabase
          .from("orders")
          .delete({ count: "exact" })
          .not("id", "is", null);
        if (ordErr) throw new Error(`orders: ${ordErr.message}`);

        console.log(`[bmth/admin-cmd/reset-data] ${count ?? "?"} pedidos removidos por ${session.u}`);
        return res.status(200).json({
          ok: true,
          message: `Reset concluído: ${count ?? "?"} pedido(s) e todos os eventos removidos.`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal error";
        console.error("[bmth/admin-cmd/reset-data]", err);
        return res.status(500).json({ error: message });
      }
    }

    case "discord-test": {
      const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL);
      if (!webhookConfigured) {
        return res.status(200).json({
          ok: false,
          error: "DISCORD_WEBHOOK_URL não configurado neste ambiente.",
        });
      }
      try {
        const { httpStatus, sentAt } = await discordSendTest();
        console.log(`[bmth/admin-cmd/discord-test] status=${httpStatus} by ${session.u}`);
        return res.status(200).json({
          ok: true,
          httpStatus,
          message: `Mensagem enviada com sucesso. HTTP ${httpStatus} — ${sentAt}`,
          sentAt,
          webhookConfigured,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[bmth/admin-cmd/discord-test]", err);
        return res.status(200).json({ ok: false, error: message, webhookConfigured });
      }
    }

    case "exclude": {
      const rawId =
        typeof body.orderId === "string" ? body.orderId.trim().toLowerCase() : "";
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      if (!UUID_RE.test(rawId)) {
        return res
          .status(200)
          .json({ ok: false, error: "ID inválido (informe o ID completo do pedido)." });
      }
      try {
        const supabase = createAdminSupabase();

        const { data: order, error: fetchErr } = await supabase
          .from("orders")
          .select("id, phone, amount, order_status, source_original_path, source_preview_path")
          .eq("id", rawId)
          .maybeSingle();
        if (fetchErr) throw new Error(fetchErr.message);
        if (!order) {
          return res.status(200).json({ ok: false, error: "Pedido não encontrado." });
        }

        // Guarda: pedidos pagos/aprovados não podem ser excluídos pelo /exclude.
        const blocked = new Set([...PAID_STATUSES, ...DELIVERED_STATUSES]);
        if (blocked.has(order.order_status)) {
          return res.status(200).json({
            ok: false,
            error: `Pedido pago/aprovado (status "${order.order_status}") — exclusão bloqueada pelo /exclude.`,
          });
        }

        // Storage (best-effort, não-fatal): foto original/preview + resultados.
        try {
          const sourcePaths = [order.source_original_path, order.source_preview_path].filter(
            (p): p is string => typeof p === "string" && p.length > 0,
          );
          if (sourcePaths.length > 0) {
            await supabase.storage.from(ORDER_SOURCE_BUCKET).remove(sourcePaths);
          }
          const { data: results } = await supabase
            .from("order_results")
            .select("result_path, preview_path")
            .eq("order_id", rawId);
          const resultPaths = (results ?? [])
            .flatMap((r) => [r.result_path, r.preview_path])
            .filter((p): p is string => typeof p === "string" && p.length > 0);
          if (resultPaths.length > 0) {
            await supabase.storage.from(ORDER_RESULTS_BUCKET).remove(resultPaths);
          }
        } catch (storageErr) {
          console.warn("[bmth/admin-cmd/exclude] limpeza de storage falhou (ignorado)", storageErr);
        }

        // Apaga a linha — ON DELETE CASCADE remove order_events/order_results/order_deliveries.
        const { error: delErr, count } = await supabase
          .from("orders")
          .delete({ count: "exact" })
          .eq("id", rawId);
        if (delErr) throw new Error(delErr.message);
        if (!count) {
          return res
            .status(200)
            .json({ ok: false, error: "Pedido não encontrado (já removido?)." });
        }

        const short = rawId.slice(0, 8);
        const valor =
          order.amount == null
            ? "—"
            : `R$ ${Number(order.amount).toFixed(2).replace(".", ",")}`;
        console.log(
          `[bmth/admin-cmd/exclude] ${rawId} (${order.order_status}) por ${session.u}`,
        );
        return res.status(200).json({
          ok: true,
          message: `Pedido ${short} excluído (${order.phone ?? "sem telefone"}, ${valor}).`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal error";
        console.error("[bmth/admin-cmd/exclude]", err);
        return res.status(500).json({ error: message });
      }
    }

    default:
      return res.status(400).json({ error: `Comando desconhecido: "${command}"` });
  }
}
