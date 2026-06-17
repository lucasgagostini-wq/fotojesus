import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────── console administrativo ───────────────────────────

type ConsoleEntry = { id: number; type: "cmd" | "ok" | "err" | "info" | "prompt"; text: string };
type ConsoleStage = "idle" | "confirm" | "running";
type ConsoleCtx = {
  push: (type: ConsoleEntry["type"], text: string) => void;
  setStage: React.Dispatch<React.SetStateAction<ConsoleStage>>;
  setPending: React.Dispatch<React.SetStateAction<(() => Promise<void>) | null>>;
  refresh: () => void;
  orders: Order[];
};

type CommandDef = { description: string; run: (args: string[], ctx: ConsoleCtx) => Promise<void> };

const COMMANDS: Record<string, CommandDef> = {
  help: {
    description: "Lista os comandos disponíveis",
    run: async (_args, ctx) => {
      ctx.push("info", "Comandos disponíveis:");
      for (const [name, def] of Object.entries(COMMANDS)) {
        ctx.push("info", `  /${name.padEnd(18)} — ${def.description}`);
      }
    },
  },
  "discord-test": {
    description: "Envia mensagem de teste ao webhook Discord",
    run: async (_args, ctx) => {
      ctx.push("info", "Enviando mensagem de teste para o Discord...");
      try {
        const res = await fetch("/api/bmth/admin-cmd", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "discord-test" }),
        });
        const data = await res.json() as {
          ok: boolean;
          message?: string;
          error?: string;
          httpStatus?: number;
          sentAt?: string;
          webhookConfigured?: boolean;
        };
        if (!data.ok) {
          ctx.push("err", `✗ ${data.error ?? "Falha ao enviar mensagem"}`);
          if (data.webhookConfigured === false) {
            ctx.push("err", "  ❌ DISCORD_WEBHOOK_URL não configurado");
          }
        } else {
          ctx.push("ok",   `✓ Mensagem enviada com sucesso`);
          ctx.push("info", `  HTTP Status : ${data.httpStatus ?? "—"}`);
          ctx.push("info", `  Horário     : ${data.sentAt ?? "—"}`);
        }
      } catch (err) {
        ctx.push("err", `✗ ${err instanceof Error ? err.message : "Erro de rede"}`);
      }
    },
  },
  "reset-data": {
    description: "Apaga TODOS os dados (orders + order_events)",
    run: async (_args, ctx) => {
      ctx.push("info", "⚠️  ATENÇÃO: Esta ação é irreversível.");
      ctx.push("prompt", 'Tem certeza que deseja apagar TODOS os dados?\nDigite CONFIRMAR para prosseguir.');
      ctx.setStage("confirm");
      ctx.setPending(() => async () => {
        ctx.push("info", "Executando /reset-data...");
        try {
          const res = await fetch("/api/bmth/admin-cmd", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "reset-data" }),
          });
          const data = await res.json() as { ok?: boolean; message?: string; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
          ctx.push("ok", `✓ ${data.message ?? "Dados apagados com sucesso."}`);
          ctx.refresh();
        } catch (err) {
          ctx.push("err", `✗ ${err instanceof Error ? err.message : "Erro ao executar"}`);
        }
      });
    },
  },
  exclude: {
    description: "Exclui UM pedido pelo código (8 caracteres) ou ID completo",
    run: async (args, ctx) => {
      const code = (args[0] ?? "").trim().toLowerCase();
      if (!code) {
        ctx.push("err", "Uso: /exclude <código de 8 caracteres ou ID completo>");
        return;
      }
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const matches = UUID_RE.test(code)
        ? ctx.orders.filter((o) => o.id.toLowerCase() === code)
        : ctx.orders.filter((o) => o.id.toLowerCase().startsWith(code));

      if (matches.length === 0) {
        ctx.push("err", `Nenhum pedido com código "${code}" na lista atual.`);
        ctx.push("info", "Ajuste o filtro/busca para trazer o pedido à tela, ou use o ID completo.");
        return;
      }
      if (matches.length > 1) {
        ctx.push("err", `Código "${code}" é ambíguo (${matches.length} pedidos). Use o ID completo:`);
        for (const o of matches.slice(0, 8)) {
          ctx.push("info", `  ${o.id}  ${fmtPhone(o.phone)}  ${fmtAmount(o.amount)}`);
        }
        return;
      }

      const order = matches[0];
      ctx.push("info", "Pedido selecionado para exclusão:");
      ctx.push("info", `  Código   : ${order.id.slice(0, 8)}  (${order.id})`);
      ctx.push("info", `  Telefone : ${fmtPhone(order.phone)}`);
      ctx.push("info", `  Valor    : ${fmtAmount(order.amount)}`);
      ctx.push("info", `  Status   : ${order.order_status}`);
      ctx.push("info", `  Origem   : ${order.source ?? "—"}`);
      ctx.push("prompt", "Digite CONFIRMAR para excluir este pedido (irreversível).");
      ctx.setStage("confirm");
      ctx.setPending(() => async () => {
        ctx.push("info", `Excluindo pedido ${order.id.slice(0, 8)}...`);
        try {
          const res = await fetch("/api/bmth/admin-cmd", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "exclude", orderId: order.id }),
          });
          const data = await res.json() as { ok?: boolean; message?: string; error?: string };
          if (!data.ok) throw new Error(data.error ?? "Falha ao excluir");
          ctx.push("ok", `✓ ${data.message ?? "Pedido excluído."}`);
          ctx.refresh();
        } catch (err) {
          ctx.push("err", `✗ ${err instanceof Error ? err.message : "Erro ao excluir"}`);
        }
      });
    },
  },
};

function TerminalSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function AdminConsole({ refresh, orders }: { refresh: () => void; orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<ConsoleStage>("idle");
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [dismissedInput, setDismissedInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const initRef = useRef(false);

  const suggestions = useMemo(() => {
    if (!input.startsWith("/") || stage !== "idle") return [];
    const query = input.slice(1).toLowerCase();
    return Object.keys(COMMANDS).filter((name) => name.startsWith(query));
  }, [input, stage]);

  const showSuggestions =
    suggestions.length > 0 &&
    input !== dismissedInput &&
    !(suggestions.length === 1 && input === `/${suggestions[0]}`);

  useEffect(() => { setSelectedIdx(-1); }, [suggestions]);

  function applySuggestion(name: string) {
    setInput(`/${name}`);
    setDismissedInput("");
    setSelectedIdx(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Tab") {
      e.preventDefault();
      const target = selectedIdx >= 0 ? suggestions[selectedIdx] : suggestions[0];
      if (target) applySuggestion(target);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedInput(input);
      setSelectedIdx(-1);
    }
  }

  const push = useCallback((type: ConsoleEntry["type"], text: string) => {
    setEntries((prev) => [...prev, { id: idRef.current++, type, text }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (!initRef.current) {
        initRef.current = true;
        push("info", "Console BMTH v1.0 — Digite /help para listar comandos.");
      }
    }
  }, [open, push]);

  const ctx: ConsoleCtx = { orders, push, refresh, setPending, setStage };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = input.trim();
    if (!val || stage === "running") return;
    setInput("");

    if (stage === "confirm") {
      push("cmd", val);
      if (val === "CONFIRMAR") {
        setStage("running");
        const fn = pending;
        setPending(null);
        if (fn) await fn();
        setStage("idle");
      } else {
        push("info", "Operação cancelada.");
        setPending(null);
        setStage("idle");
      }
      return;
    }

    push("cmd", `> ${val}`);

    if (!val.startsWith("/")) {
      push("err", "Comandos devem começar com /. Digite /help.");
      return;
    }

    const [rawName, ...args] = val.slice(1).split(/\s+/);
    const name = rawName ?? "";
    const cmd = COMMANDS[name];
    if (!cmd) {
      push("err", `Comando não encontrado: /${name}. Digite /help.`);
      return;
    }

    await cmd.run(args, ctx);
  };

  const ENTRY_CLS: Record<ConsoleEntry["type"], string> = {
    cmd:    "text-zinc-300",
    ok:     "text-emerald-400",
    err:    "text-rose-400",
    info:   "text-zinc-500",
    prompt: "text-amber-400",
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Console administrativo"
        aria-label="Abrir console"
        className={`fixed bottom-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-colors ${
          open
            ? "border-zinc-500 bg-zinc-800 text-zinc-200"
            : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        }`}
      >
        <TerminalSvg />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed bottom-[72px] right-5 z-50 flex w-[min(440px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
          {/* Barra de título */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div className="flex items-center gap-2">
              <TerminalSvg />
              <span className="font-mono text-xs font-semibold text-zinc-400">bmth-console</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
              aria-label="Fechar console"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Log */}
          <div className="h-60 space-y-0.5 overflow-y-auto p-3">
            {entries.map((e) => (
              <p key={e.id} className={`font-mono text-xs leading-relaxed whitespace-pre-wrap break-all ${ENTRY_CLS[e.type]}`}>
                {e.text}
              </p>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && (
            <div className="border-t border-zinc-800/60 bg-zinc-950">
              {suggestions.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(name); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 font-mono text-xs transition-colors ${
                    i === selectedIdx
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60"
                  }`}
                >
                  <span className="text-zinc-600">/</span>
                  <span className={i === selectedIdx ? "text-zinc-100" : "text-zinc-300"}>{name}</span>
                  <span className="ml-auto truncate text-[10px] text-zinc-600">{COMMANDS[name]?.description}</span>
                  {i === selectedIdx && (
                    <kbd className="shrink-0 rounded border border-zinc-700 px-1 py-px font-mono text-[9px] text-zinc-500">TAB</kbd>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2">
            <span className="font-mono text-xs text-zinc-600 select-none">
              {stage === "confirm" ? "confirm>" : stage === "running" ? "·····" : "$"}
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); setDismissedInput(""); }}
              onKeyDown={handleKeyDown}
              disabled={stage === "running"}
              placeholder={stage === "confirm" ? "CONFIRMAR ou qualquer outra coisa para cancelar" : "/comando"}
              className="flex-1 bg-transparent font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-700 disabled:opacity-40"
            />
          </form>
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/BMTH/")({
  component: BmthPage,
});

// ─────────────────────────── helpers compartilhados ───────────────────────────

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
  email: null | string;
  amount: null | number;
  label: null | string;
  purchased_styles: null | number[];
  order_status: string;
  paid_at: null | string;
  mp_payment_id: null | string;
  source: null | string;
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
  { key: "jesus", label: "🟡 Jesus" },
  { key: "aparecida", label: "🔵 Aparecida" },
];

function CodeChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copiar ID completo"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(id)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-300 hover:bg-zinc-800"
    >
      {copied ? "copiado!" : id.slice(0, 8)}
    </button>
  );
}

function SourceBadge({ source }: { source: null | string }) {
  if (source === "jesus") {
    return <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 whitespace-nowrap">🟡 JESUS</span>;
  }
  if (source === "aparecida") {
    return <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-300 whitespace-nowrap">🔵 APARECIDA</span>;
  }
  return <span className="text-xs text-zinc-600">SEM ORIGEM</span>;
}

const AUTO_REFRESH_MS = 15_000; // intervalo do polling automático do painel: 15s

type FunnelRoute = {
  landing: number; photo_confirmed: number; styles: number; results: number;
  offer_view: number; offer_accepted: number; offer_declined: number;
  phone_modal: number; phone: number; pix: number; approved: number; delivered: number;
};
type FunnelData = { jesus: FunnelRoute; aparecida: FunnelRoute };

const FUNNEL_STEPS: { key: keyof FunnelRoute; label: string }[] = [
  { key: "landing", label: "Landing" },
  { key: "photo_confirmed", label: "Upload" },
  { key: "styles", label: "Estilos" },
  { key: "results", label: "Resultados" },
  { key: "phone", label: "Telefone" },
  { key: "pix", label: "PIX" },
  { key: "approved", label: "Aprovado" },
  { key: "delivered", label: "Entregue" },
];

function FunnelColumn({ title, accent, data }: { title: string; accent: string; data: FunnelRoute | undefined }) {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="mb-3 text-sm font-bold" style={{ color: accent }}>{title}</p>
      <div className="flex flex-col">
        {FUNNEL_STEPS.map((step, i) => {
          const value = data?.[step.key] ?? 0;
          const next = i < FUNNEL_STEPS.length - 1 ? (data?.[FUNNEL_STEPS[i + 1].key] ?? 0) : null;
          return (
            <div key={step.key}>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-zinc-300">{step.label}</span>
                <span className="text-sm font-bold tabular-nums text-zinc-100">{value}</span>
              </div>
              {next !== null && (
                <div className="flex items-center gap-1.5 pb-1 pl-1 text-[11px] text-zinc-500">
                  <span className="text-zinc-600">↳</span>
                  <span className="tabular-nums">{pct(next, value)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
        Oferta: {data?.offer_view ?? 0} vista · {data?.offer_accepted ?? 0} aceita · {data?.offer_declined ?? 0} recusada
      </div>
    </div>
  );
}

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/bmth/dashboard", { credentials: "include" });
      if (res.ok) setDash(await res.json());
    } catch {
      /* silencioso — cards apenas */
    }
  }, []);

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    // No polling silencioso não mexemos no estado de loading nem no erro: a
    // tabela atual permanece visível (sem flicker, sem alterar o scroll) e uma
    // falha transitória não apaga os dados já carregados.
    if (!opts?.silent) {
      setLoadingOrders(true);
      setError("");
    }
    try {
      const params = new URLSearchParams({ filter, page: String(page), search });
      const res = await fetch(`/api/bmth/orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      const body = await res.json();
      setOrders(body.orders);
      setTotalPages(body.totalPages);
      setTotal(body.total);
      setLastUpdated(new Date());
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : "Erro");
    } finally {
      if (!opts?.silent) setLoadingOrders(false);
    }
  }, [filter, page, search]);

  // Funnel Analytics — isolado: falha silenciosa, nunca afeta o resto do painel.
  const loadFunnel = useCallback(async () => {
    try {
      const res = await fetch("/api/bmth/funnel", { credentials: "include" });
      if (res.ok) setFunnel(await res.json());
    } catch {
      /* silencioso */
    }
  }, []);

  const refresh = useCallback(() => {
    void loadDashboard();
    void loadOrders();
  }, [loadDashboard, loadOrders]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadFunnel();
  }, [loadFunnel]);

  // Atualização automática (polling 15s): recarrega cards, métricas, últimos
  // pagamentos e tabela de pedidos SEM reload e sem perder filtro/busca/scroll.
  // O efeito recria o intervalo quando filtro/página/busca mudam (deps de
  // loadOrders/loadDashboard), garantindo que cada ciclo use o estado atual.
  useEffect(() => {
    const id = window.setInterval(() => {
      void Promise.all([loadDashboard(), loadOrders({ silent: true }), loadFunnel()]);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadDashboard, loadOrders, loadFunnel]);

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
        {/* Indicador de atualização automática (polling 15s) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Atualização automática ativa
          </span>
          <span className="text-zinc-500">
            Última atualização:{" "}
            <span className="font-medium text-zinc-300">
              {lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour12: false }) : "—"}
            </span>
          </span>
        </div>

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
                      <th className="px-3 py-2.5 font-medium">E-mail</th>
                      <th className="px-3 py-2.5 font-medium">Valor</th>
                      <th className="px-3 py-2.5 font-medium">Estilos</th>
                      <th className="px-3 py-2.5 font-medium">Origem</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Código</th>
                      <th className="px-3 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {loadingOrders && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                          Carregando...
                        </td>
                      </tr>
                    )}
                    {error && !loadingOrders && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-rose-400">
                          {error}
                        </td>
                      </tr>
                    )}
                    {!loadingOrders && !error && orders.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
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
                            <td className="px-3 py-2.5 text-zinc-400">
                              <span className="block max-w-[160px] truncate" title={o.email ?? undefined}>{o.email ?? "—"}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-100">
                              {fmtAmount(o.amount)}
                            </td>
                            <td className="px-3 py-2.5 text-zinc-400">
                              {styles.length > 0 ? styles.join(", ") : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <SourceBadge source={o.source} />
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={o.order_status} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <CodeChip id={o.id} />
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

        {/* Funnel Analytics */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Funnel Analytics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FunnelColumn title="🟡 JESUS" accent="#F5A623" data={funnel?.jesus} />
            <FunnelColumn title="🔵 APARECIDA" accent="#378ADD" data={funnel?.aparecida} />
          </div>
        </section>
      </main>
      <AdminConsole refresh={refresh} orders={orders} />
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
