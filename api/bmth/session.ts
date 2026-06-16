import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "../_lib/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");

  const session = requireSession(req);
  if (!session) return res.status(401).json({ authenticated: false });

  return res.status(200).json({ authenticated: true, username: session.u });
}
