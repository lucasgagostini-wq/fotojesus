import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSupabaseAdminClient, getRequiredEnv, isDev } from "./_lib/payment-flow.js";

// Allowlist de eventos de funil aceitos (rejeita o resto silenciosamente).
const FUNNEL_EVENTS = new Set([
  "landing_view",
  "upload_view",
  "styles_view",
  "loading_view",
  "results_view",
  "pix_view",
  "photo_confirmed",
  "offer_view",
  "offer_accepted",
  "offer_declined",
  "phone_modal_open",
  "phone_submit",
]);
const FUNNEL_SOURCES = new Set(["jesus", "aparecida"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Endpoint público de tracking de funil. Aditivo e isolado: SEMPRE responde 204,
 * mesmo em erro/entrada inválida — assim o sendBeacon nunca re-tenta e o cliente
 * jamais vê erro. Nenhuma lógica de negócio depende disto.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    if (isDev()) return res.status(204).end(); // sem env → no-op

    let body: { sessionId?: unknown; source?: unknown; event?: unknown; orderId?: unknown };
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    } catch {
      return res.status(204).end();
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 100) : "";
    const source = typeof body.source === "string" ? body.source : "";
    const event = typeof body.event === "string" ? body.event : "";
    const orderId =
      typeof body.orderId === "string" && UUID_RE.test(body.orderId) ? body.orderId : null;

    if (!sessionId || !FUNNEL_SOURCES.has(source) || !FUNNEL_EVENTS.has(event)) {
      return res.status(204).end(); // entrada inválida → ignora
    }

    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const { error } = await supabase.from("funnel_events").insert({
      session_id: sessionId,
      route_source: source,
      event_name: event,
      order_id: orderId,
    });
    if (error) console.error("[track]", error.message);

    return res.status(204).end();
  } catch (err) {
    console.error("[track]", err);
    return res.status(204).end(); // nunca propaga erro
  }
}
