import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";

const COOKIE_NAME = "bmth_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

type SessionPayload = { exp: number; u: string };

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function safeEqualStr(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function getAdminCredentials(): { password: string; username: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { password, username };
}

export function validateCredentials(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  if (!creds) return false;
  // Compara ambos sempre (evita short-circuit timing leak)
  const userOk = safeEqualStr(username, creds.username);
  const passOk = safeEqualStr(password, creds.password);
  return userOk && passOk;
}

function sign(payloadB64: string, key: string): string {
  return createHmac("sha256", key).update(payloadB64).digest("hex");
}

export function createSessionToken(username: string): null | string {
  const creds = getAdminCredentials();
  if (!creds) return null;
  const payload: SessionPayload = { exp: Date.now() + SESSION_TTL_MS, u: username };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = sign(payloadB64, creds.password);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): null | SessionPayload {
  const creds = getAdminCredentials();
  if (!creds) return null;

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const payloadB64 = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = sign(payloadB64, creds.password);

  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.u !== "string") return null;

  return payload;
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function isSecureRequest(req: VercelRequest): boolean {
  const proto = req.headers["x-forwarded-proto"];
  const protoStr = Array.isArray(proto) ? proto[0] : proto;
  const host = req.headers.host ?? "";
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) return false;
  return protoStr ? protoStr === "https" : true;
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse, token: string): void {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse): void {
  const attrs = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (isSecureRequest(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

/**
 * Valida a sessão a partir do cookie httpOnly.
 * Retorna o payload (com username) se válido, ou null.
 * Use em TODA rota administrativa antes de qualquer consulta sensível.
 */
export function requireSession(req: VercelRequest): null | SessionPayload {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}
