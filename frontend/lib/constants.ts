/**
 * Unified application constants and configuration
 * These can be made user-configurable through settings in the future
 */

export const APP_CONSTANTS = {
  // Polling intervals (milliseconds)
  POLLING: {
    MESSAGES: 1000,        // Poll for new messages every 1 second
    CHANNELS: 1000,        // Poll for channel list every 1 second
    CONNECTION_STATE: 1000, // Poll for connection state every 1 second
    USER_LIST: 2000,       // Poll for user list every 2 seconds
    IRC_LOGS: 1000,        // Poll for IRC logs every 1 second
  },

  // Message display limits
  MESSAGES: {
    MAX_DISPLAYED: 500,    // Maximum messages to keep in DOM
    PRUNE_TO: 400,         // Prune down to this many when limit exceeded
    INITIAL_LOAD: 100,     // Initial messages to load
  },

  // IRC Protocol
  IRC: {
    DEFAULT_PORT: 6667,
    DEFAULT_SSL_PORT: 6697,
    RECONNECT_DELAY: 5000, // Milliseconds between reconnect attempts
  },

  // UI
  UI: {
    PANEL_SIZES: {
      SERVER_LIST_DEFAULT: 15,
      SERVER_LIST_MIN: 12,
      SERVER_LIST_MAX: 25,
      CHAT_DEFAULT: 75,
      CHAT_MIN: 50,
      USER_LIST_DEFAULT: 25,
      USER_LIST_MIN: 15,
      USER_LIST_MAX: 35,
      IRC_LOG_DEFAULT: 30,
      IRC_LOG_MIN: 5,
      IRC_LOG_MAX: 50,
      IRC_LOG_COLLAPSED: 5,
    },
  },
} as const;

// Export individual sections for convenience
export const { POLLING, MESSAGES, IRC, UI } = APP_CONSTANTS;
