/**
 * Helper centralizado de notificações Discord para eventos de pagamento.
 * Nunca lança exceção — falha de notificação jamais quebra o fluxo de PIX/pagamento.
 * A URL vem exclusivamente da env DISCORD_WEBHOOK_URL (nunca hardcoded).
 */

import { styleLabel } from "../../src/lib/style-catalog.js";

const COLOR = {
  approved: 0xf5760a, // laranja "fogo"
  error: 0xfacc15, // amarelo
  pix: 0x00a3e0, // azul
  rejected: 0xef4444, // vermelho
};

function fmtAmount(amount: null | number | undefined): string {
  if (amount == null) return "—";
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}

function fmtPhone(phone: null | string | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function fmtStyles(
  source: null | string | undefined,
  styleIds: number[] | null | undefined,
): string {
  if (!styleIds || styleIds.length === 0) return "—";
  return styleIds.map((id) => `${id} — ${styleLabel(source, id)}`).join("\n");
}

function nowSaoPaulo(): string {
  return new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  });
}

type Embed = {
  color: number;
  fields: { inline?: boolean; name: string; value: string }[];
  timestamp?: string;
  title: string;
};

function getMention(): string | undefined {
  const id = process.env.DISCORD_USER_ID;
  return id ? `<@${id}>` : undefined;
}

/**
 * Envio de baixo nível — fire-and-forget, swallow de qualquer erro.
 * A menção (`@usuário`) só é incluída quando `opts.mention === true`. Por padrão
 * NENHUMA notificação menciona ninguém — apenas o pagamento aprovado opta por isso.
 */
async function send(embed: Embed, opts?: { mention?: boolean }): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const mention = opts?.mention ? getMention() : undefined;
  try {
    await fetch(url, {
      body: JSON.stringify({
        ...(mention ? { content: mention } : {}),
        embeds: [{ timestamp: new Date().toISOString(), ...embed }],
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch (err) {
    console.error("[discord] notification failed", err);
  }
}

// ─────────────────── Teste de integração (admin console) ─────────────────────

/**
 * Envia uma mensagem de teste ao webhook Discord e retorna o status HTTP.
 * Diferente de `send`, esta função lança em caso de falha para que o chamador
 * possa reportar o erro ao operador.
 */
export async function sendTest(): Promise<{ httpStatus: number; sentAt: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error("DISCORD_WEBHOOK_URL não configurado neste ambiente.");

  const sentAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  });

  const body = JSON.stringify({
    embeds: [
      {
        title: "🚀 TESTE DE INTEGRAÇÃO BMTH",
        color: 0x00c06e,
        fields: [
          { inline: true,  name: "Ambiente",  value: "Produção" },
          { inline: true,  name: "Data/Hora", value: sentAt },
          { inline: false, name: "Projeto",   value: "Sua Foto com Jesus" },
          { inline: false, name: "Origem",    value: "Painel BMTH → Console Administrativo" },
          { inline: false, name: "Status",    value: "✅ Webhook Discord funcionando corretamente." },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });

  const res = await fetch(url, {
    body,
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Discord retornou ${res.status}: ${detail.slice(0, 200)}`);
  }

  return { httpStatus: res.status, sentAt };
}

// ─────────────────────────── Evento 1 — PIX gerado ────────────────────────────

export async function notifyPixGenerated(params: {
  amount: null | number;
  orderId: string;
  paymentId: null | string;
  phone: null | string;
  selectedStyleIds: number[];
  source?: null | string;
}): Promise<void> {
  const origemLabel = params.source === "aparecida" ? "🔵 APARECIDA" : params.source === "jesus" ? "🟡 JESUS" : "—";
  await send({
    color: COLOR.pix,
    fields: [
      { inline: true, name: "Valor", value: fmtAmount(params.amount) },
      { inline: true, name: "Status", value: "pending" },
      { inline: true, name: "Origem", value: origemLabel },
      { inline: false, name: "Telefone", value: fmtPhone(params.phone) },
      { inline: false, name: "Estilos", value: fmtStyles(params.source, params.selectedStyleIds) },
      { inline: false, name: "Payment ID", value: `\`${params.paymentId ?? "—"}\`` },
      { inline: false, name: "Pedido", value: `\`${params.orderId}\`` },
      { inline: false, name: "Data", value: nowSaoPaulo() },
    ],
    title: "🧾 PIX GERADO",
  });
}

// ─────────────────────── Evento 2 — Pagamento aprovado ────────────────────────

export async function notifyPaymentApproved(params: {
  amount: null | number;
  orderId: string;
  paymentId: null | string;
  phone: null | string;
  purchasedStyleIds: number[];
  source?: null | string;
}): Promise<void> {
  const origemLabel = params.source === "aparecida" ? "🔵 APARECIDA" : params.source === "jesus" ? "🟡 JESUS" : "—";
  await send({
    color: COLOR.approved,
    fields: [
      { inline: true, name: "Valor", value: fmtAmount(params.amount) },
      { inline: true, name: "Status", value: "approved" },
      { inline: true, name: "Origem", value: origemLabel },
      { inline: false, name: "Telefone", value: fmtPhone(params.phone) },
      { inline: false, name: "Estilos", value: fmtStyles(params.source, params.purchasedStyleIds) },
      { inline: false, name: "Payment ID", value: `\`${params.paymentId ?? "—"}\`` },
      { inline: false, name: "Pedido", value: `\`${params.orderId}\`` },
      { inline: false, name: "Data", value: nowSaoPaulo() },
    ],
    title: "🔥 PAGAMENTO APROVADO",
  }, { mention: true }); // ÚNICA notificação que menciona o usuário (@) no Discord.
}

// ─────────────────────── Evento 3 — Pagamento rejeitado ───────────────────────

export async function notifyPaymentRejected(params: {
  amount: null | number;
  orderId: string;
  paymentId: null | string;
  phone: null | string;
  status?: string;
}): Promise<void> {
  await send({
    color: COLOR.rejected,
    fields: [
      { inline: true, name: "Valor", value: fmtAmount(params.amount) },
      { inline: true, name: "Status", value: params.status ?? "rejected" },
      { inline: false, name: "Telefone", value: fmtPhone(params.phone) },
      { inline: false, name: "Payment ID", value: `\`${params.paymentId ?? "—"}\`` },
      { inline: false, name: "Pedido", value: `\`${params.orderId}\`` },
      { inline: false, name: "Data", value: nowSaoPaulo() },
    ],
    title: "❌ PAGAMENTO REJEITADO",
  });
}

// ─────────────────────────────── Evento 4 — Erro ──────────────────────────────

export async function notifyFlowError(params: {
  endpoint: string;
  message: string;
}): Promise<void> {
  await send({
    color: COLOR.error,
    fields: [
      { inline: false, name: "Endpoint", value: params.endpoint },
      { inline: false, name: "Erro", value: params.message.slice(0, 1000) },
      { inline: false, name: "Data", value: nowSaoPaulo() },
    ],
    title: "⚠️ ERRO NO FLUXO",
  });
}
