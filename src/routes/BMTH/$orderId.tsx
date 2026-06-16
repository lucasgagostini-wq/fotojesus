import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { fmtAmount, fmtDate, fmtPhone, StatusBadge, STYLE_LABELS } from "./index";

export const Route = createFileRoute("/BMTH/$orderId")({
  component: OrderDetailPage,
});

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
  source: null | string;
  recovery_code: null | string;
  created_at: string;
  updated_at: null | string;
  mp_payment_id: null | string;
  mp_status: string;
  last_webhook_at: null | string;
};

type DetailResponse = { order: OrderDetail; sourcePreviewUrl: null | string };

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`text-sm text-zinc-100 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bmth/order?id=${encodeURIComponent(orderId)}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        void navigate({ to: "/BMTH" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao carregar pedido");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const phoneDigits = data?.order.phone ? data.order.phone.replace(/\D/g, "") : "";
  const isDelivered = data ? ["delivered", "delivery_sent"].includes(data.order.order_status) : false;

  async function copyPhone() {
    if (!phoneDigits) return;
    try {
      await navigator.clipboard.writeText(phoneDigits);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function openWhatsApp() {
    if (!phoneDigits) return;
    window.open(`https://wa.me/55${phoneDigits}`, "_blank", "noopener,noreferrer");
  }

  async function markDelivered() {
    if (!confirm("Marcar este pedido como ENTREGUE?")) return;
    setMarking(true);
    try {
      const res = await fetch("/api/bmth/mark-delivered", {
        body: JSON.stringify({ orderId }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao atualizar");
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao marcar");
    } finally {
      setMarking(false);
    }
  }

  const styles = data && Array.isArray(data.order.purchased_styles) ? data.order.purchased_styles : [];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#09090b]/95 px-4 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            to="/BMTH"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-none">Detalhe do pedido</h1>
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{orderId}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading && <p className="py-12 text-center text-sm text-zinc-500">Carregando...</p>}
        {error && <p className="py-12 text-center text-sm text-rose-400">{error}</p>}

        {data && (
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            {/* Foto + ações */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                {data.sourcePreviewUrl ? (
                  <img
                    src={data.sourcePreviewUrl}
                    alt="Foto original do cliente"
                    className="aspect-[3/4] w-full bg-zinc-950 object-contain"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-600">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.5-3.5L9 20" />
                    </svg>
                    <span className="text-xs">Sem foto original</span>
                  </div>
                )}
                <div className="px-3 py-2 text-[11px] text-zinc-500">Foto enviada pelo cliente</div>
              </div>

              {/* Ações de entrega manual */}
              <div className="space-y-2">
                <button
                  onClick={() => void copyPhone()}
                  disabled={!phoneDigits}
                  className="w-full rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                >
                  {copied ? "✓ Copiado" : "Copiar telefone"}
                </button>
                <button
                  onClick={openWhatsApp}
                  disabled={!phoneDigits}
                  className="w-full rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  Abrir WhatsApp
                </button>
                <button
                  onClick={() => void markDelivered()}
                  disabled={marking || isDelivered}
                  className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40"
                >
                  {isDelivered ? "✓ Já entregue" : marking ? "Salvando..." : "Marcar como entregue"}
                </button>
              </div>
            </div>

            {/* Dados */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <span className="text-sm text-zinc-400">Status atual</span>
                <StatusBadge status={data.order.order_status} />
              </div>

              <div className="grid grid-cols-1 divide-y divide-zinc-800/70 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 sm:grid-cols-2 sm:divide-y-0">
                <Row label="Telefone" value={fmtPhone(data.order.phone)} />
                <Row label="Valor" value={fmtAmount(data.order.amount)} />
                <Row label="Origem" value={
                  data.order.source === "aparecida"
                    ? "🔵 APARECIDA"
                    : data.order.source === "jesus"
                    ? "🟡 JESUS"
                    : "SEM ORIGEM"
                } />
                <Row label="Recovery Code" value={data.order.recovery_code} mono />
                <Row label="Order ID" value={data.order.id} mono />
                <Row label="Payment ID" value={data.order.mp_payment_id} mono />
                <Row label="MP Status" value={data.order.mp_status} />
                <Row label="Criado em" value={fmtDate(data.order.created_at)} />
                <Row label="Pago em" value={fmtDate(data.order.paid_at)} />
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Estilos comprados</p>
                {styles.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {styles.map((id) => (
                      <li key={id} className="flex items-center gap-2 text-sm text-zinc-200">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[11px] font-bold text-zinc-400">
                          {id}
                        </span>
                        {STYLE_LABELS[id] ?? `Estilo ${id}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">—</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
