import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role para uso EXCLUSIVO em rotas admin server-side.
 * A service_role key nunca é exposta ao frontend.
 */
export function createAdminSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env vars ausentes");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Início do dia atual no fuso America/Sao_Paulo (UTC-3, sem DST), em ISO UTC. */
export function startOfTodaySaoPauloISO(): string {
  const SP_OFFSET_MS = -3 * 60 * 60 * 1000;
  const now = new Date();
  const sp = new Date(now.getTime() + SP_OFFSET_MS);
  // Meia-noite SP = data SP às 00:00 -03:00 = 03:00 UTC do mesmo dia
  const startUtc = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3, 0, 0);
  return new Date(startUtc).toISOString();
}

export const PAID_STATUSES = [
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

export const DELIVERED_STATUSES = ["delivered", "delivery_sent"];
