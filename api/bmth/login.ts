import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createSessionToken,
  getAdminCredentials,
  setSessionCookie,
  validateCredentials,
} from "../_lib/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!getAdminCredentials()) {
    return res.status(500).json({ error: "Painel não configurado (ADMIN_USERNAME/ADMIN_PASSWORD ausentes)" });
  }

  const body = (req.body ?? {}) as { password?: unknown; username?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  if (!validateCredentials(username, password)) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = createSessionToken(username);
  if (!token) {
    return res.status(500).json({ error: "Falha ao criar sessão" });
  }

  setSessionCookie(req, res, token);
  return res.status(200).json({ ok: true, username });
}
