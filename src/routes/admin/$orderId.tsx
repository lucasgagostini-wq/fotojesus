import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/$orderId")({
  component: OrderDetailPage,
});

const SESSION_KEY = "admin_token";

type OrderDetail = {
  id: string;
  phone: null | string;
  amount: null | number;
  label: null | string;
  price_key: null | string;
  purchased_styles: null | number[];
  selected_styles: null | number[];
  paid_at: null | string;
  order_status: string;
  recovery_code: null | string;
  created_at: string;
  updated_at: null | string;
  mp_payment_id: null | string;
  mp_status: string;
  last_webhook_at: null | string;
};

type Delivery = {
  channel: string;
  status: string;
  destination: null | string;
  attempts: null | number;
  last_attempt_at: null | string;
  sent_at: null | string;
  last_error: null | string;
};

type Event = {
  event_type: string;
  payload: unknown;
  created_at: string;
};

type DetailResponse = {
  order: OrderDetail;
  results: unknown[];
  deliveries: Delivery[];
  events: Event[];
  sourcePreviewUrl: null | string;
  sourceOriginalUrl: null | string;
};

function formatDate(iso: null | string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatPhone(phone: null | string) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function formatAmount(amount: null | number) {
  if (amount == null) return "—";
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    payment_approved: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    delivery_sent: "bg-emerald-100 text-emerald-800",
    delivery_failed: "bg-red-100 text-red-800",
    processing_failed: "bg-red-100 text-red-800",
  };
  const cls = colors[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900">{value ?? "—"}</span>
    </div>
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const token = (() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) ?? "";
    } catch {
      return "";
    }
  })();

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/order?id=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Erro ao carregar pedido");
      }
      const body = await res.json() as DetailResponse;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orderId]);

  async function markDelivered() {
    if (!confirm("Marcar como entregue?")) return;
    setMarking(true);
    try {
      const res = await fetch("/api/admin/mark-delivered", {
        body: JSON.stringify({ orderId }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Falha ao atualizar pedido");
      }
      setMarkSuccess(true);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao marcar como entregue");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/admin"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            ←
          </Link>
          <div>
            <h1 className="font-bold text-gray-900">Detalhes do Pedido</h1>
            <p className="font-mono text-xs text-gray-400">{orderId}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {loading && <p className="text-center text-sm text-gray-400">Carregando...</p>}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        {data && (
          <>
            {/* Photo */}
            {data.sourcePreviewUrl && (
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <img
                  src={data.sourcePreviewUrl}
                  alt="Foto original do cliente"
                  className="w-full max-h-64 object-contain bg-gray-100"
                />
                <div className="px-4 py-2 text-xs text-gray-400">Foto original enviada pelo cliente</div>
              </div>
            )}

            {/* Main info */}
            <div className="rounded-xl bg-white shadow-sm divide-y divide-gray-100">
              <div className="px-4 py-4 flex items-center justify-between">
                <StatusBadge status={data.order.order_status} />
                {!["delivery_sent", "cancelled"].includes(data.order.order_status) && (
                  <button
                    onClick={() => void markDelivered()}
                    disabled={marking}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {marking ? "Salvando..." : "✓ Marcar como entregue"}
                  </button>
                )}
                {markSuccess && data.order.order_status === "delivery_sent" && (
                  <span className="text-sm text-emerald-600 font-medium">Entregue ✓</span>
                )}
              </div>

              <div className="px-4 py-4 grid grid-cols-2 gap-4">
                <Field label="WhatsApp" value={formatPhone(data.order.phone)} />
                <Field label="Valor" value={formatAmount(data.order.amount)} />
                <Field label="Produto" value={data.order.label} />
                <Field label="Recovery Code" value={
                  <span className="font-mono text-base tracking-widest">{data.order.recovery_code ?? "—"}</span>
                } />
              </div>

              <div className="px-4 py-4 grid grid-cols-2 gap-4">
                <Field
                  label="Estilos comprados"
                  value={
                    Array.isArray(data.order.purchased_styles) && data.order.purchased_styles.length > 0
                      ? `Estilos ${data.order.purchased_styles.join(", ")}`
                      : "—"
                  }
                />
                <Field
                  label="Estilos selecionados"
                  value={
                    Array.isArray(data.order.selected_styles) && data.order.selected_styles.length > 0
                      ? `Estilos ${data.order.selected_styles.join(", ")}`
                      : "—"
                  }
                />
              </div>

              <div className="px-4 py-4 grid grid-cols-2 gap-4">
                <Field label="Criado em" value={formatDate(data.order.created_at)} />
                <Field label="Pago em" value={formatDate(data.order.paid_at)} />
                <Field label="Atualizado em" value={formatDate(data.order.updated_at)} />
                <Field label="Último webhook" value={formatDate(data.order.last_webhook_at)} />
              </div>

              <div className="px-4 py-4 grid grid-cols-2 gap-4">
                <Field label="MP Payment ID" value={
                  <span className="font-mono text-xs">{data.order.mp_payment_id ?? "—"}</span>
                } />
                <Field label="MP Status" value={data.order.mp_status} />
              </div>
            </div>

            {/* Deliveries */}
            {data.deliveries.length > 0 && (
              <div className="rounded-xl bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h2 className="font-medium text-gray-900 text-sm">Entregas</h2>
                </div>
                {data.deliveries.map((d, i) => (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 grid grid-cols-2 gap-2 text-sm">
                    <Field label="Canal" value={d.channel} />
                    <Field label="Status" value={<StatusBadge status={d.status} />} />
                    <Field label="Destino" value={d.destination} />
                    <Field label="Tentativas" value={String(d.attempts ?? 0)} />
                    {d.last_error && <Field label="Último erro" value={<span className="text-red-600 text-xs">{d.last_error}</span>} />}
                    {d.sent_at && <Field label="Enviado em" value={formatDate(d.sent_at)} />}
                  </div>
                ))}
              </div>
            )}

            {/* Events */}
            {data.events.length > 0 && (
              <div className="rounded-xl bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h2 className="font-medium text-gray-900 text-sm">Histórico de eventos</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.events.map((ev, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-600">{ev.event_type}</span>
                      <span className="text-xs text-gray-400">{formatDate(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original photo link */}
            {data.sourceOriginalUrl && (
              <div className="text-center">
                <a
                  href={data.sourceOriginalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Ver foto original em tamanho completo ↗
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
