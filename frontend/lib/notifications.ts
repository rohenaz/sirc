/**
 * Browser notification utilities for IRC mentions and messages
 * Uses Web Notifications API for browser notifications
 * (Wails3 native notifications will be used when running as desktop app)
 */

export interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
}

let permission: NotificationPermission = "default";

/**
 * Request permission to show notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("[Notifications] Browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    permission = "granted";
    return true;
  }

  if (Notification.permission === "denied") {
    permission = "denied";
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    permission = result;
    return result === "granted";
  } catch (error) {
    console.error("[Notifications] Failed to request permission:", error);
    return false;
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
  return (
    "Notification" in window &&
    (Notification.permission === "granted" || permission === "granted")
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Show a browser notification
 */
export function showNotification(options: NotificationOptions): Notification | null {
  if (!canShowNotifications()) {
    console.debug("[Notifications] Cannot show notification - no permission");
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      tag: options.tag,
      icon: options.icon || "/favicon.ico",
      requireInteraction: options.requireInteraction || false,
      badge: options.icon || "/favicon.ico",
    });

    // Auto-close after 5 seconds unless requireInteraction is true
    if (!options.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }

    // Log for debugging
    console.log("[Notifications] Shown:", options.title);

    return notification;
  } catch (error) {
    console.error("[Notifications] Failed to show notification:", error);
    return null;
  }
}

/**
 * Show notification for a mention
 */
export function showMentionNotification(
  from: string,
  channel: string,
  message: string,
  server?: string,
): Notification | null {
  const title = channel.startsWith("#")
    ? `${from} mentioned you in ${channel}`
    : `Private message from ${from}`;

  const body =
    message.length > 100 ? `${message.substring(0, 97)}...` : message;

  return showNotification({
    title,
    body,
    tag: `mention-${channel}-${from}`,
    requireInteraction: false,
  });
}

/**
 * Show notification for a private message
 */
export function showPrivateMessageNotification(
  from: string,
  message: string,
): Notification | null {
  const body =
    message.length > 100 ? `${message.substring(0, 97)}...` : message;

  return showNotification({
    title: `Private message from ${from}`,
    body,
    tag: `pm-${from}`,
    requireInteraction: true,
  });
}

/**
 * Show notification for a keyword highlight
 */
export function showKeywordNotification(
  from: string,
  channel: string,
  message: string,
  keyword: string,
): Notification | null {
  const body =
    message.length > 100 ? `${message.substring(0, 97)}...` : message;

  return showNotification({
    title: `"${keyword}" mentioned in ${channel} by ${from}`,
    body,
    tag: `keyword-${channel}-${from}`,
    requireInteraction: false,
  });
}

/**
 * Notification preferences stored in localStorage
 */
interface NotificationPreferences {
  enabled: boolean;
  mentionsOnly: boolean;
  keywords: string[];
  sound: boolean;
  notifyWhenFocused: boolean;
}

const PREFS_KEY = "irc-notification-prefs";

/**
 * Get notification preferences from localStorage
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") {
    return getDefaultPreferences();
  }

  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...getDefaultPreferences(), ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("[Notifications] Failed to load preferences:", error);
  }

  return getDefaultPreferences();
}

/**
 * Save notification preferences to localStorage
 */
export function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): void {
  if (typeof window === "undefined") return;

  try {
    const current = getNotificationPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    console.log("[Notifications] Preferences saved:", updated);
  } catch (error) {
    console.error("[Notifications] Failed to save preferences:", error);
  }
}

/**
 * Get default notification preferences
 */
function getDefaultPreferences(): NotificationPreferences {
  return {
    enabled: true,
    mentionsOnly: true,
    keywords: [],
    sound: false,
    notifyWhenFocused: false,
  };
}

/**
 * Check if should notify based on preferences and window state
 */
export function shouldNotify(
  isMention: boolean,
  isKeyword: boolean,
): boolean {
  const prefs = getNotificationPreferences();

  // Check if notifications are enabled
  if (!prefs.enabled) {
    return false;
  }

  // Check if window is focused and we don't want notifications when focused
  if (!prefs.notifyWhenFocused && typeof document !== "undefined" && document.hasFocus()) {
    return false;
  }

  // Check mentions-only mode
  if (prefs.mentionsOnly) {
    return isMention || isKeyword;
  }

  // Notify for all messages
  return true;
}
