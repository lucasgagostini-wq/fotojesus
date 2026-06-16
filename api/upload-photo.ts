import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { ClientInputError, createSupabaseAdminClient, getRequiredEnv, isDev } from "./_lib/payment-flow.js";
import {
  buildOrderAccessResponse,
  createOrUpdateDraftOrderWithUpload,
} from "./_lib/orders.js";

function decodeBase64Image(raw: unknown, fieldName: string): Uint8Array {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ClientInputError(`Missing ${fieldName}`);
  }

  try {
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length === 0) {
      throw new Error("empty");
    }

    return bytes;
  } catch {
    throw new ClientInputError(`Invalid ${fieldName}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (isDev()) {
    console.warn("[DEV MOCK] upload-photo — env vars ausentes, retornando mock");
    const body = (req.body ?? {}) as { mimeType?: string; previewBase64?: string };
    const sourcePreviewUrl =
      typeof body.previewBase64 === "string" && typeof body.mimeType === "string"
        ? `data:${body.mimeType};base64,${body.previewBase64}`
        : null;
    return res.status(200).json({
      order: {
        accessToken: "dev_token_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        amount: null,
        createdAt: new Date().toISOString(),
        deliveries: [],
        id: "devorder0-0000-0000-0000-000000000000",
        label: null,
        mpStatus: "",
        orderStatus: "photo_uploaded",
        paidAt: null,
        phoneNumber: null,
        pixCode: null,
        priceKey: null,
        purchasedStyleIds: [],
        qrBase64: null,
        recoveryCode: "12345678",
        results: [],
        selectedStyleIds: [],
        sourcePreviewUrl,
      },
    });
  }

  try {
    const body = (req.body ?? {}) as {
      accessToken?: unknown;
      mimeType?: unknown;
      orderId?: unknown;
      originalBase64?: unknown;
      previewBase64?: unknown;
    };

    if (typeof body.mimeType !== "string" || !body.mimeType.startsWith("image/")) {
      throw new ClientInputError("Invalid mime type");
    }

    const originalBytes = decodeBase64Image(body.originalBase64, "originalBase64");
    const previewBytes = decodeBase64Image(body.previewBase64, "previewBase64");

    if (originalBytes.byteLength > 4_000_000 || previewBytes.byteLength > 1_000_000) {
      throw new ClientInputError("Uploaded image is too large");
    }

    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const sha256 = createHash("sha256").update(originalBytes).digest("hex");
    const order = await createOrUpdateDraftOrderWithUpload({
      existingAccessToken:
        typeof body.accessToken === "string" ? body.accessToken : undefined,
      existingOrderId: typeof body.orderId === "string" ? body.orderId : undefined,
      mimeType: body.mimeType,
      originalBytes,
      previewBytes,
      sha256,
      supabase,
    });

    const payload = await buildOrderAccessResponse({ order, supabase });
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (err instanceof ClientInputError) {
      return res.status(400).json({ error: message });
    }

    console.error("[upload-photo]", err);
    return res.status(500).json({ error: message });
  }
}
