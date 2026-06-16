import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

const SESSION_KEY = "admin_token";

type Order = {
  id: string;
  phone: null | string;
  amount: null | number;
  label: null | string;
  purchased_styles: null | number[];
  paid_at: null | string;
  order_status: string;
  source_preview_path: null | string;
  created_at: string;
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
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${value}` },
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, value);
        onAuth(value);
      } else {
        setError("Senha incorreta.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-gray-900">Admin FotoJesus</h1>
        <p className="mb-6 text-sm text-gray-500">Digite a senha de acesso para continuar.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !value}
            className="rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const styles = Array.isArray(order.purchased_styles) ? order.purchased_styles : [];

  return (
    <Link
      to="/admin/$orderId"
      params={{ orderId: order.id }}
      className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-gray-400">{order.id.slice(0, 8)}…</span>
          <StatusBadge status={order.order_status} />
        </div>
        <div className="mt-1 flex gap-4 text-sm text-gray-700 flex-wrap">
          <span>📱 {formatPhone(order.phone)}</span>
          <span>💰 {formatAmount(order.amount)}</span>
          {styles.length > 0 && <span>🎨 Estilos {styles.join(", ")}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-gray-400">
        <div>{formatDate(order.paid_at)}</div>
      </div>
    </Link>
  );
}

function OrderList({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      const data = await res.json() as { orders: Order[] };
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">FotoJesus — Admin</h1>
            <p className="text-xs text-gray-500">{orders.length} pedidos aprovados</p>
          </div>
          <button
            onClick={() => void load()}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Atualizar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        {loading && (
          <p className="p-8 text-center text-sm text-gray-400">Carregando...</p>
        )}
        {error && (
          <p className="p-8 text-center text-sm text-red-500">{error}</p>
        )}
        {!loading && !error && orders.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-400">Nenhum pedido aprovado ainda.</p>
        )}
        {!loading && orders.length > 0 && (
          <div className="rounded-b-xl bg-white shadow-sm">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPage() {
  const [token, setToken] = useState<null | string>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  if (!token) {
    return <LoginGate onAuth={setToken} />;
  }

  return <OrderList token={token} />;
}
