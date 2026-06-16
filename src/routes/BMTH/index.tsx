import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/BMTH/")({
  component: BmthPage,
});

// ─────────────────────────── helpers compartilhados ───────────────────────────

export const STYLE_LABELS: Record<number, string> = {
  1: "Jesus te abraçando",
  2: "Jesus ao seu lado sorrindo",
  3: "Jesus segurando sua mão",
  4: "Momento no campo com Jesus",
};

export function fmtDate(iso: null | string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function fmtPhone(phone: null | string) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

export function fmtAmount(amount: null | number) {
  if (amount == null) return "—";
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}

const STATUS_STYLES: Record<string, string> = {
  payment_pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  payment_approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  processing: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  delivery_sent: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  delivered: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ───────────────────────────────── tipos ──────────────────────────────────────

type Order = {
  id: string;
  created_at: string;
  phone: null | string;
  amount: null | number;
  label: null | string;
  purchased_styles: null | number[];
  order_status: string;
  paid_at: null | string;
  mp_payment_id: null | string;
};

type Dashboard = {
  ordersToday: number;
  paymentsPending: number;
  paymentsApproved: number;
  revenueToday: number;
  revenueTotal: number;
  recentApproved: { id: string; phone: null | string; amount: null | number; paid_at: null | string }[];
};

// ──────────────────────────────── login ───────────────────────────────────────

function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bmth/login", {
        body: JSON.stringify({ password, username }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.ok) {
        onAuth();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Credenciais inválidas");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-lg font-black text-zinc-900">
            B
          </div>
          <h1 className="text-lg font-bold text-zinc-100">Painel BMTH</h1>
          <p className="mt-1 text-sm text-zinc-500">Operação interna — acesso restrito</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            ref={userRef}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuário"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-1 rounded-lg bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────── dashboard ────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? "text-amber-400" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagos" },
  { key: "delivered", label: "Entregues" },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/bmth/dashboard", { credentials: "include" });
      if (res.ok) setDash(await res.json());
    } catch {
      /* silencioso — cards apenas */
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const params = new URLSearchParams({ filter, page: String(page), search });
      const res = await fetch(`/api/bmth/orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      const body = await res.json();
      setOrders(body.orders);
      setTotalPages(body.totalPages);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoadingOrders(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function logout() {
    await fetch("/api/bmth/logout", { credentials: "include", method: "POST" }).catch(() => {});
    onLogout();
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-sm font-black text-zinc-900">
              B
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">Painel BMTH</h1>
              <p className="mt-0.5 text-[11px] text-zinc-500">Operação manual de entregas</p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Pedidos hoje" value={dash ? String(dash.ordersToday) : "—"} />
          <StatCard label="Pagam. pendentes" value={dash ? String(dash.paymentsPending) : "—"} />
          <StatCard label="Pagam. aprovados" value={dash ? String(dash.paymentsApproved) : "—"} />
          <StatCard label="Faturamento hoje" value={dash ? fmtAmount(dash.revenueToday) : "—"} accent />
          <StatCard label="Faturamento total" value={dash ? fmtAmount(dash.revenueTotal) : "—"} accent />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Lista de pedidos */}
          <section className="order-2 lg:order-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setPage(1);
                      setFilter(f.key);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === f.key
                        ? "bg-zinc-100 text-zinc-900"
                        : "border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <form onSubmit={applySearch} className="flex gap-1.5">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Telefone ou order ID"
                  className="w-44 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Buscar
                </button>
              </form>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Telefone</th>
                      <th className="px-3 py-2.5 font-medium">Valor</th>
                      <th className="px-3 py-2.5 font-medium">Estilos</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {loadingOrders && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                          Carregando...
                        </td>
                      </tr>
                    )}
                    {error && !loadingOrders && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-rose-400">
                          {error}
                        </td>
                      </tr>
                    )}
                    {!loadingOrders && !error && orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                          Nenhum pedido encontrado.
                        </td>
                      </tr>
                    )}
                    {!loadingOrders &&
                      orders.map((o) => {
                        const styles = Array.isArray(o.purchased_styles) ? o.purchased_styles : [];
                        return (
                          <tr key={o.id} className="hover:bg-zinc-900/50">
                            <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">{fmtDate(o.created_at)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-zinc-200">{fmtPhone(o.phone)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-100">
                              {fmtAmount(o.amount)}
                            </td>
                            <td className="px-3 py-2.5 text-zinc-400">
                              {styles.length > 0 ? styles.join(", ") : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={o.order_status} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                              <Link
                                to="/BMTH/$orderId"
                                params={{ orderId: o.id }}
                                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                              >
                                Abrir
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginação */}
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>{total} pedido(s)</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-zinc-700 px-2.5 py-1 font-medium text-zinc-300 disabled:opacity-30 enabled:hover:bg-zinc-800"
                >
                  Anterior
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-zinc-700 px-2.5 py-1 font-medium text-zinc-300 disabled:opacity-30 enabled:hover:bg-zinc-800"
                >
                  Próximo
                </button>
              </div>
            </div>
          </section>

          {/* Últimos pagamentos aprovados */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-200">Últimos pagamentos aprovados</h2>
              </div>
              <div className="divide-y divide-zinc-800/70">
                {dash?.recentApproved?.length ? (
                  dash.recentApproved.map((r) => (
                    <Link
                      key={r.id}
                      to="/BMTH/$orderId"
                      params={{ orderId: r.id }}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-900/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-200">{fmtPhone(r.phone)}</p>
                        <p className="text-[11px] text-zinc-500">{fmtDate(r.paid_at)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-amber-400">{fmtAmount(r.amount)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-xs text-zinc-500">Nenhum pagamento ainda.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────── gate raiz ────────────────────────────────────

function BmthPage() {
  const [authState, setAuthState] = useState<"checking" | "in" | "out">("checking");

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/bmth/session", { credentials: "include" });
      setAuthState(res.ok ? "in" : "out");
    } catch {
      setAuthState("out");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <p className="text-sm text-zinc-500">Carregando...</p>
      </div>
    );
  }

  if (authState === "out") {
    return <LoginScreen onAuth={() => setAuthState("in")} />;
  }

  return <Dashboard onLogout={() => setAuthState("out")} />;
}
