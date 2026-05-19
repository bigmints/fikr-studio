"use client"

/**
 * Safe wrapper around Umami's global `umami.track()` API.
 * No-op when Umami isn't loaded (Electron dev, blocked network, etc.).
 */

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void
    }
  }
}

function track(event: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.umami) return
  try {
    window.umami.track(event, data)
  } catch {
    // Fail silently — analytics is non-critical
  }
}

export const analytics = { track }
