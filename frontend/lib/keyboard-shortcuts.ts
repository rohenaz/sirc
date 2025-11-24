/**
 * Keyboard shortcuts system for SIRC
 * Provides a centralized way to manage and handle keyboard shortcuts
 */

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean; // Cmd on Mac
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
  handler: () => void;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
): boolean {
  // Normalize key comparison (case-insensitive)
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (eventKey !== shortcutKey) return false;

  // Check modifiers
  // On Mac, Cmd (metaKey) should match ctrl in shortcut definitions
  // On Windows/Linux, Ctrl (ctrlKey) should match ctrl in shortcut definitions
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

  if (shortcut.ctrl && !cmdOrCtrl) return false;
  if (!shortcut.ctrl && cmdOrCtrl) return false;

  if (shortcut.meta && !event.metaKey) return false;
  if (!shortcut.meta && event.metaKey && !shortcut.ctrl) return false;

  if (shortcut.shift && !event.shiftKey) return false;
  if (!shortcut.shift && event.shiftKey) return false;

  if (shortcut.alt && !event.altKey) return false;
  if (!shortcut.alt && event.altKey) return false;

  return true;
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.meta && !isMac) {
    parts.push("Meta");
  }
  if (shortcut.shift) {
    parts.push(isMac ? "⇧" : "Shift");
  }
  if (shortcut.alt) {
    parts.push(isMac ? "⌥" : "Alt");
  }

  // Capitalize the key
  const key = shortcut.key.toUpperCase();
  parts.push(key);

  return parts.join(isMac ? "" : "+");
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Exception: Allow Escape to work in inputs
        if (event.key !== "Escape") {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Group shortcuts by category for display
 */
export function groupShortcutsByCategory(
  shortcuts: KeyboardShortcut[],
): ShortcutCategory[] {
  const categories = new Map<string, KeyboardShortcut[]>();

  for (const shortcut of shortcuts) {
    const existing = categories.get(shortcut.category) || [];
    existing.push(shortcut);
    categories.set(shortcut.category, existing);
  }

  return Array.from(categories.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts,
  }));
}

/**
 * Get platform-specific modifier key name
 */
export function getModifierKey(): "Cmd" | "Ctrl" {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "Cmd" : "Ctrl";
}

/**
 * Check if running on Mac
 */
export function isMacOS(): boolean {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}
