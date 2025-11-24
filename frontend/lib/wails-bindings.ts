/**
 * Wails Bindings Wrapper
 *
 * This module provides a type-safe, client-side-only wrapper for Wails bindings.
 * It ensures bindings are only loaded in the browser and provides proper TypeScript types.
 */

import type * as IRCService from "@/bindings/sirc/pkg/services/ircservice";

// Type-safe bindings interface
export interface WailsBindings {
  GetServers: typeof IRCService.GetServers;
  GetChannels: typeof IRCService.GetChannels;
  SendMessage: typeof IRCService.SendMessage;
  GetMessages: typeof IRCService.GetMessages;
  GetConnectionState: typeof IRCService.GetConnectionState;
  Connect: typeof IRCService.Connect;
  Disconnect: typeof IRCService.Disconnect;
  JoinChannel: typeof IRCService.JoinChannel;
  PartChannel: typeof IRCService.PartChannel;
  RemoveServer: typeof IRCService.RemoveServer;
  GetLogs: typeof IRCService.GetLogs;
  ListChannels: typeof IRCService.ListChannels;
  GetChannelList: typeof IRCService.GetChannelList;
  IsChannelListInProgress: typeof IRCService.IsChannelListInProgress;
  AddServer: typeof IRCService.AddServer;
  GetServerTemplates: typeof IRCService.GetServerTemplates;
  SendCTCP: typeof IRCService.SendCTCP;
}

// Singleton instance
let bindingsInstance: WailsBindings | null = null;
let loadingPromise: Promise<WailsBindings> | null = null;

/**
 * Load Wails bindings (client-side only)
 * Returns a cached instance on subsequent calls
 */
export async function loadWailsBindings(): Promise<WailsBindings> {
  // Return cached instance if available
  if (bindingsInstance) {
    return bindingsInstance;
  }

  // Return existing loading promise if one is in progress
  if (loadingPromise) {
    return loadingPromise;
  }

  // Check if we're in the browser
  if (typeof window === "undefined") {
    throw new Error("Wails bindings can only be loaded in the browser");
  }

  // Start loading bindings
  loadingPromise = (async () => {
    try {
      const module = await import("@/bindings/sirc/pkg/services/ircservice");

      bindingsInstance = {
        GetServers: module.GetServers,
        GetChannels: module.GetChannels,
        SendMessage: module.SendMessage,
        GetMessages: module.GetMessages,
        GetConnectionState: module.GetConnectionState,
        Connect: module.Connect,
        Disconnect: module.Disconnect,
        JoinChannel: module.JoinChannel,
        PartChannel: module.PartChannel,
        RemoveServer: module.RemoveServer,
        GetLogs: module.GetLogs,
        ListChannels: module.ListChannels,
        GetChannelList: module.GetChannelList,
        IsChannelListInProgress: module.IsChannelListInProgress,
        AddServer: module.AddServer,
        GetServerTemplates: module.GetServerTemplates,
        SendCTCP: module.SendCTCP,
      };

      return bindingsInstance;
    } catch (error) {
      loadingPromise = null;
      throw new Error(`Failed to load Wails bindings: ${error}`);
    }
  })();

  return loadingPromise;
}

/**
 * Get bindings instance (throws if not loaded)
 */
export function getBindings(): WailsBindings {
  if (!bindingsInstance) {
    throw new Error("Wails bindings not loaded. Call loadWailsBindings() first.");
  }
  return bindingsInstance;
}

/**
 * Check if bindings are loaded
 */
export function areBindingsLoaded(): boolean {
  return bindingsInstance !== null;
}
