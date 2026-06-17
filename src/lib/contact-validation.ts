/**
 * Validação de contato compartilhada entre frontend (PhoneModal) e backend
 * (parseCheckoutRequest). Fonte única de verdade — front e back SEMPRE concordam,
 * eliminando o caso "passa no front e o backend rejeita".
 * Sem APIs externas, sem requests: validação instantânea de formato.
 */

/** Números obviamente falsos rejeitados explicitamente (além do "mesmo dígito repetido"). */
const OBVIOUS_FAKE_PHONES = new Set([
  "12345678901",
  "1234567890",
  "01234567890",
  "0123456789",
]);

/**
 * Aceita WhatsApp brasileiro: 10 ou 11 dígitos. Rejeita: número com o mesmo
 * dígito repetido (11111111111, 00000000000, 99999999999, 22222222222...),
 * exemplos óbvios (12345678901...) e DDD começando com 0.
 */
export function isValidBrWhatsApp(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 10 && d.length !== 11) return false;
  if (new Set(d).size === 1) return false; // todos os dígitos iguais
  if (OBVIOUS_FAKE_PHONES.has(d)) return false;
  if (d[0] === "0") return false; // DDD não começa com 0
  return true;
}

/** Validação de formato básico de e-mail (sem MX, sem verificação de existência). */
export function isValidEmail(raw: string): boolean {
  const e = (raw ?? "").trim();
  if (e.length === 0 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Normaliza e-mail para persistência (trim + lowercase). */
export function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}
