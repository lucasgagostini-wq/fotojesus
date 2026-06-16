# Painel Administrativo `/BMTH`

Painel interno para **operação manual das entregas** do FotoJesus. Não altera o funil de
vendas, checkout, Mercado Pago, webhook nem o fluxo de recuperação de pedidos.

**Data de criação:** 2026-06-16

---

## Como acessar

1. Configure as variáveis de ambiente na Vercel (ver abaixo) e faça o deploy.
2. Acesse `https://sua-foto-com-jesus.vercel.app/BMTH`.
3. Informe **usuário** e **senha** (definidos em `ADMIN_USERNAME` / `ADMIN_PASSWORD`).
4. A sessão é mantida por **7 dias** via cookie `bmth_session` (httpOnly, Secure, SameSite=Lax).

## Como fazer logout

- Botão **Sair** no topo do painel → chama `POST /api/bmth/logout`, que limpa o cookie.

## Como realizar uma entrega manual

1. No dashboard, localize o pedido (filtros **Pagos** ou busca por telefone/order ID).
2. Clique em **Abrir** para ver os detalhes.
3. Use **Copiar telefone** ou **Abrir WhatsApp** (`https://wa.me/55{telefone}`, nova aba).
4. Envie as imagens ao cliente pelo WhatsApp.
5. Clique em **Marcar como entregue** → atualiza `order_status = delivered` e registra
   um evento `admin_marked_delivered` em `order_events` (com usuário e status anterior).

---

## Variáveis de ambiente necessárias

| Variável | Uso | Exposta ao frontend? |
|---|---|---|
| `ADMIN_USERNAME` | Usuário de login do painel | ❌ Nunca |
| `ADMIN_PASSWORD` | Senha + chave de assinatura do cookie de sessão | ❌ Nunca |
| `SUPABASE_URL` | Consultas server-side | ❌ Nunca |
| `SUPABASE_SERVICE_ROLE_KEY` | Consultas server-side (service_role) | ❌ Nunca |

Trocar `ADMIN_PASSWORD` **invalida todas as sessões** (o HMAC do cookie é chaveado por ela).

---

## Estrutura de autenticação

- **Login:** `POST /api/bmth/login` valida usuário/senha (comparação em tempo constante via
  SHA-256 + `timingSafeEqual`) e emite um cookie `bmth_session`.
- **Cookie:** `base64url({u, exp}) . HMAC-SHA256(payload, key=ADMIN_PASSWORD)`.
  Atributos: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
  (`Secure` é omitido apenas em `localhost`.)
- **Validação:** toda rota administrativa chama `requireSession(req)` antes de qualquer
  consulta sensível. Sessão inválida/expirada → `401`.
- **Logout:** `POST /api/bmth/logout` define o cookie com `Max-Age=0`.

Nenhum segredo (service_role, token MP, webhook secret) é enviado ao frontend — todas as
consultas passam pelas APIs protegidas.

---

## APIs (`api/bmth/`)

Todos os endpoints são servidos por **uma única função serverless** —
`api/bmth/[action].ts` (rota dinâmica) — para respeitar o limite de 12 funções
do plano Hobby da Vercel. A Vercel mapeia `/api/bmth/<action>` → `[action].ts`.

| Rota | Método | Protegida | Função |
|---|---|---|---|
| `/api/bmth/login` | POST | — | Valida credenciais e emite cookie |
| `/api/bmth/logout` | POST | — | Limpa o cookie |
| `/api/bmth/session` | GET | ✅ | Verifica se a sessão é válida |
| `/api/bmth/dashboard` | GET | ✅ | Estatísticas + últimos pagamentos aprovados |
| `/api/bmth/orders` | GET | ✅ | Lista paginada (filtros + busca) |
| `/api/bmth/order` | GET | ✅ | Detalhe + signed URL da foto (4h) |
| `/api/bmth/mark-delivered` | POST | ✅ | `order_status=delivered` + evento |

Bibliotecas (em `_lib`, não contam como função serverless):
`admin-auth.ts` (sessão/cookie), `admin-db.ts` (Supabase admin + helpers),
`bmth-handlers.ts` (lógica de cada endpoint, despachada pelo `[action].ts`).

## Rotas de frontend criadas

| Rota | Arquivo | Função |
|---|---|---|
| `/BMTH` | `src/routes/BMTH/index.tsx` | Gate de login + dashboard + lista + últimos pagos |
| `/BMTH/$orderId` | `src/routes/BMTH/$orderId.tsx` | Detalhe do pedido + entrega manual |

**Tema dark** isolado: paleta zinc aplicada apenas nos componentes BMTH (sem toggle global,
sem `dark:` class). O restante do site permanece no tema claro original.

---

## Fluxo operacional manual

```
Cliente paga PIX → webhook aprova → pedido aparece em /BMTH (filtro "Pagos")
  → operador abre detalhe → copia telefone / abre WhatsApp → envia imagens
  → "Marcar como entregue" → order_status=delivered + order_events
```

---

## Pendências futuras

- Busca por order_id parcial (hoje exige UUID completo; telefone aceita parcial).
- Rate limiting no `POST /api/bmth/login` (mitigar brute force).
- Realtime/auto-refresh do dashboard (hoje recarrega ao trocar filtro/página).
- Exibir histórico de `order_events` na tela de detalhe.
- Geração de imagens por IA e entrega automática via WhatsApp (substituiria o passo manual).
