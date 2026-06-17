/**
 * Funnel Analytics — coleta fire-and-forget, 100% aditiva.
 *
 * NUNCA bloqueia nem quebra o funil: tudo em try/catch, enviado via sendBeacon
 * (não aguardado). Se falhar, o checkout/upload/pagamento seguem normalmente.
 *
 * `session_id` é gerado 1× por carregamento de página, em memória (sem
 * localStorage/sessionStorage). Como é um SPA, o id é estável durante toda a
 * jornada num único load. Um refresh manual = nova sessão (ruído pequeno,
 * aceitável para visibilidade operacional).
 */

const SESSION_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.round(Math.random() * 1e9)}`;

export type FunnelSource = "aparecida" | "jesus";

export function trackFunnel(
  source: FunnelSource,
  event: string,
  orderId?: null | string,
): void {
  try {
    if (typeof navigator === "undefined") return;
    const body = JSON.stringify({
      sessionId: SESSION_ID,
      source,
      event,
      orderId: orderId ?? null,
    });

    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics jamais lança — silencia qualquer erro.
  }
}
