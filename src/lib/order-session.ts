import type { StoredOrderSession } from "./order-contract";

/**
 * Isolamento de sessão por funil + expiração automática (TTL).
 *
 * Cada rota tem chaves próprias e independentes — uma rota NUNCA lê os dados de
 * outra:
 *   - order_session_{scope}    → { accessToken, orderId, recoveryCode }
 *   - selected_styles_{scope}  → number[] (estilos escolhidos na grade)
 *   - selected_images_{scope}  → number[] (imagens escolhidas nos resultados)
 *
 * Todo valor é gravado com timestamp (`savedAt`) e expira após 6 horas.
 */

export type SessionScope = "jesus" | "aparecida" | "v2";

/** Time-to-live de qualquer dado local de sessão: 6 horas. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

/** Chave compartilhada da versão anterior (sem isolamento) — removida no load. */
const LEGACY_SESSION_KEY = "fotojesus-order-session";

const sessionKey = (scope: SessionScope) => `order_session_${scope}`;
const stylesKey = (scope: SessionScope) => `selected_styles_${scope}`;
const imagesKey = (scope: SessionScope) => `selected_images_${scope}`;

type Stamped<T> = { savedAt: number; value: T };

function hasStorage(): boolean {
  return typeof window !== "undefined";
}

/**
 * Lê um valor com TTL. Retorna null (e remove a chave) se ausente, malformado
 * ou expirado (> 6h).
 */
function readStamped<T>(key: string): null | T {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Stamped<T>>;
    if (typeof parsed.savedAt !== "number" || parsed.value === undefined) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value as T;
  } catch {
    return null;
  }
}

function writeStamped<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    const payload: Stamped<T> = { savedAt: Date.now(), value };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // quota cheia / modo privativo — ignora silenciosamente
  }
}

function removeKey(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

// ── Sessão do pedido (order_session_{scope}) ──────────────────────────────────

export function loadStoredOrderSession(
  scope: SessionScope,
): null | StoredOrderSession {
  const value = readStamped<StoredOrderSession>(sessionKey(scope));
  if (
    !value ||
    typeof value.orderId !== "string" ||
    typeof value.accessToken !== "string"
  ) {
    return null;
  }

  return {
    accessToken: value.accessToken,
    orderId: value.orderId,
    recoveryCode:
      typeof value.recoveryCode === "string" ? value.recoveryCode : null,
  };
}

export function saveStoredOrderSession(
  scope: SessionScope,
  session: StoredOrderSession,
): void {
  writeStamped(sessionKey(scope), session);
}

/** Limpa apenas a sessão/pedido desta rota (preserva as seleções para retry). */
export function clearStoredOrderSession(scope: SessionScope): void {
  removeKey(sessionKey(scope));
}

// ── Estilos selecionados (selected_styles_{scope}) ────────────────────────────

export function loadSelectedStyles(scope: SessionScope): null | number[] {
  const value = readStamped<number[]>(stylesKey(scope));
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is number => typeof id === "number");
}

export function saveSelectedStyles(
  scope: SessionScope,
  styleIds: number[],
): void {
  writeStamped(stylesKey(scope), styleIds);
}

// ── Imagens selecionadas (selected_images_{scope}) ────────────────────────────

export function loadSelectedImages(scope: SessionScope): null | number[] {
  const value = readStamped<number[]>(imagesKey(scope));
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is number => typeof id === "number");
}

export function saveSelectedImages(
  scope: SessionScope,
  imageIds: number[],
): void {
  writeStamped(imagesKey(scope), imageIds);
}

// ── Expiração coordenada (TTL) ────────────────────────────────────────────────

/** Remove TODAS as chaves desta rota: sessão, access token, pedido, estilos, imagens. */
export function clearScopeSession(scope: SessionScope): void {
  removeKey(sessionKey(scope));
  removeKey(stylesKey(scope));
  removeKey(imagesKey(scope));
}

/**
 * Chamado ao abrir o site. Se a sessão desta rota existir e tiver passado do TTL
 * (> 6h), remove tudo (sessão, access token, pedido, estilos, imagens) para
 * iniciar um fluxo novo. Também remove a chave legada compartilhada da versão
 * anterior. Retorna true se algo expirou e foi limpo.
 */
export function pruneExpiredScopeSession(scope: SessionScope): boolean {
  if (!hasStorage()) return false;

  // Remove a chave compartilhada da versão sem isolamento (migração one-shot).
  removeKey(LEGACY_SESSION_KEY);

  try {
    const raw = window.localStorage.getItem(sessionKey(scope));
    if (!raw) return false; // nada salvo → nada a expirar

    const parsed = JSON.parse(raw) as Partial<Stamped<unknown>>;
    const expired =
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > SESSION_TTL_MS;

    if (expired) {
      clearScopeSession(scope);
      return true;
    }
    return false;
  } catch {
    clearScopeSession(scope);
    return true;
  }
}
