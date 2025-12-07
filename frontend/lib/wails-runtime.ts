/**
 * Client-side wrapper for Wails runtime
 * This file should only be imported in client components after hydration
 */

// Lazy import to avoid SSR issues
let EventsAPI: typeof import("@wailsio/runtime").Events | null = null;

// Initialize Events API (call this in useEffect)
export async function initializeWailsRuntime() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!EventsAPI) {
    const runtime = await import("@wailsio/runtime");
    EventsAPI = runtime.Events;
  }

  return EventsAPI;
}

export { EventsAPI as Events };
