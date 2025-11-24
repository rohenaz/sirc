/**
 * React Query Hooks for IRC Operations
 *
 * These hooks provide a type-safe, optimized way to fetch and mutate IRC data
 * with automatic caching, refetching, and error handling.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { loadWailsBindings } from "./wails-bindings";
import type { Server, Channel, Message, LogEntry, ServerTemplate } from "@/bindings/sirc/pkg/irc/models";

// Query Keys - centralized for consistency
export const queryKeys = {
  servers: ["servers"] as const,
  server: (id: string) => ["server", id] as const,
  connectionState: (serverId: string) => ["connectionState", serverId] as const,
  channels: (serverId: string) => ["channels", serverId] as const,
  messages: (serverId: string, channelName: string) => ["messages", serverId, channelName] as const,
  logs: (serverId: string) => ["logs", serverId] as const,
  channelList: (serverId: string) => ["channelList", serverId] as const,
  channelListProgress: (serverId: string) => ["channelListProgress", serverId] as const,
  serverTemplates: ["serverTemplates"] as const,
};

/**
 * Fetch all servers
 */
export function useServers(options?: Omit<UseQueryOptions<(Server | null)[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetServers();
    },
    refetchInterval: 2000, // Refetch every 2 seconds
    staleTime: 1000, // Consider data stale after 1 second
    ...options,
  });
}

/**
 * Fetch connection state for a server
 */
export function useConnectionState(serverId: string, options?: Omit<UseQueryOptions<string>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.connectionState(serverId),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetConnectionState(serverId);
    },
    enabled: !!serverId,
    refetchInterval: 1000, // Refetch every second
    staleTime: 500,
    ...options,
  });
}

/**
 * Fetch channels for a server
 */
export function useChannels(serverId: string, options?: Omit<UseQueryOptions<(Channel | null)[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.channels(serverId),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetChannels(serverId);
    },
    enabled: !!serverId,
    refetchInterval: 1000, // Refetch every second
    staleTime: 500,
    ...options,
  });
}

/**
 * Fetch messages for a channel
 */
export function useMessages(
  serverId: string,
  channelName: string,
  options?: Omit<UseQueryOptions<(Message | null)[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.messages(serverId, channelName),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetMessages(serverId, channelName);
    },
    enabled: !!serverId && !!channelName,
    refetchInterval: 1000, // Refetch every second
    staleTime: 500,
    ...options,
  });
}

/**
 * Fetch logs for a server
 */
export function useLogs(serverId: string, options?: Omit<UseQueryOptions<(LogEntry | null)[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.logs(serverId),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetLogs(serverId);
    },
    enabled: !!serverId,
    refetchInterval: 1000, // Refetch every second
    staleTime: 500,
    ...options,
  });
}

/**
 * Fetch channel list from server
 */
export function useChannelList(serverId: string, options?: Omit<UseQueryOptions<(Channel | null)[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.channelList(serverId),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetChannelList(serverId);
    },
    enabled: !!serverId,
    staleTime: 30000, // Channel list doesn't change frequently
    ...options,
  });
}

/**
 * Check if channel list is in progress
 */
export function useChannelListProgress(serverId: string, options?: Omit<UseQueryOptions<boolean>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.channelListProgress(serverId),
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.IsChannelListInProgress(serverId);
    },
    enabled: !!serverId,
    refetchInterval: 100, // Check frequently when loading
    staleTime: 50,
    ...options,
  });
}

/**
 * Fetch server templates
 */
export function useServerTemplates(options?: Omit<UseQueryOptions<ServerTemplate[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: queryKeys.serverTemplates,
    queryFn: async () => {
      const bindings = await loadWailsBindings();
      return bindings.GetServerTemplates();
    },
    staleTime: Number.POSITIVE_INFINITY, // Templates never change
    ...options,
  });
}

// Mutations

/**
 * Connect to a server
 */
export function useConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      const bindings = await loadWailsBindings();
      return bindings.Connect(serverId);
    },
    onSuccess: (_, serverId) => {
      // Invalidate connection state and channels
      queryClient.invalidateQueries({ queryKey: queryKeys.connectionState(serverId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.channels(serverId) });
    },
  });
}

/**
 * Disconnect from a server
 */
export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      const bindings = await loadWailsBindings();
      return bindings.Disconnect(serverId);
    },
    onSuccess: (_, serverId) => {
      // Invalidate connection state and channels
      queryClient.invalidateQueries({ queryKey: queryKeys.connectionState(serverId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.channels(serverId) });
    },
  });
}

/**
 * Join a channel
 */
export function useJoinChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, channel }: { serverId: string; channel: string }) => {
      const bindings = await loadWailsBindings();
      return bindings.JoinChannel(serverId, channel);
    },
    onSuccess: (_, { serverId }) => {
      // Invalidate channels list
      queryClient.invalidateQueries({ queryKey: queryKeys.channels(serverId) });
    },
  });
}

/**
 * Part a channel
 */
export function usePartChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, channel }: { serverId: string; channel: string }) => {
      const bindings = await loadWailsBindings();
      return bindings.PartChannel(serverId, channel);
    },
    onSuccess: (_, { serverId, channel }) => {
      // Invalidate channels list and messages
      queryClient.invalidateQueries({ queryKey: queryKeys.channels(serverId) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(serverId, channel) });
    },
  });
}

/**
 * Send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, target, message }: { serverId: string; target: string; message: string }) => {
      const bindings = await loadWailsBindings();
      return bindings.SendMessage(serverId, target, message);
    },
    onSuccess: (_, { serverId, target }) => {
      // Invalidate messages for this channel
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(serverId, target) });
    },
  });
}

/**
 * Add a server
 */
export function useAddServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (server: Server | null) => {
      const bindings = await loadWailsBindings();
      return bindings.AddServer(server);
    },
    onSuccess: () => {
      // Invalidate servers list
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
}

/**
 * Remove a server
 */
export function useRemoveServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      const bindings = await loadWailsBindings();
      return bindings.RemoveServer(serverId);
    },
    onSuccess: (_, serverId) => {
      // Invalidate servers list and remove all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
      queryClient.removeQueries({ queryKey: queryKeys.server(serverId) });
      queryClient.removeQueries({ queryKey: queryKeys.connectionState(serverId) });
      queryClient.removeQueries({ queryKey: queryKeys.channels(serverId) });
      queryClient.removeQueries({ queryKey: queryKeys.logs(serverId) });
    },
  });
}

/**
 * Request channel list from server
 */
export function useListChannels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      const bindings = await loadWailsBindings();
      return bindings.ListChannels(serverId);
    },
    onSuccess: (_, serverId) => {
      // Invalidate channel list
      queryClient.invalidateQueries({ queryKey: queryKeys.channelList(serverId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.channelListProgress(serverId) });
    },
  });
}

/**
 * Send CTCP command
 */
export function useSendCTCP() {
  return useMutation({
    mutationFn: async ({ serverId, target, command }: { serverId: string; target: string; command: string }) => {
      const bindings = await loadWailsBindings();
      return bindings.SendCTCP(serverId, target, command);
    },
  });
}
