import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleDashboard,
  handleLogin,
  handleLogout,
  handleMarkDelivered,
  handleOrder,
  handleOrders,
  handleSession,
} from "../_lib/bmth-handlers.js";

/**
 * Roteador único do painel BMTH. Consolida todos os endpoints em uma só
 * função serverless (limite do plano Hobby da Vercel: 12 funções).
 * Vercel mapeia /api/bmth/<action> -> [action].ts com req.query.action = <action>.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action;
  const name = typeof action === "string" ? action : Array.isArray(action) ? action[0] : "";

  switch (name) {
    case "dashboard":
      return handleDashboard(req, res);
    case "login":
      return handleLogin(req, res);
    case "logout":
      return handleLogout(req, res);
    case "mark-delivered":
      return handleMarkDelivered(req, res);
    case "order":
      return handleOrder(req, res);
    case "orders":
      return handleOrders(req, res);
    case "session":
      return handleSession(req, res);
    default:
      return res.status(404).json({ error: "Rota administrativa desconhecida" });
  }
}
