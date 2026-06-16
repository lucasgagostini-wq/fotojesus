import type { StoredOrderSession } from "./order-contract";

const STORAGE_KEY = "fotojesus-order-session";

export function loadStoredOrderSession(): null | StoredOrderSession {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredOrderSession>;
    if (
      typeof parsed.orderId !== "string" ||
      typeof parsed.accessToken !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      orderId: parsed.orderId,
      recoveryCode:
        typeof parsed.recoveryCode === "string" ? parsed.recoveryCode : null,
    };
  } catch {
    return null;
  }
}

export function saveStoredOrderSession(session: StoredOrderSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredOrderSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
