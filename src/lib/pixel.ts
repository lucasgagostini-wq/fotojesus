declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(event: string, name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(event, name, params);
  }
}

export function pixelTrack(name: string, params?: Record<string, unknown>) {
  fbq('track', name, params);
}
