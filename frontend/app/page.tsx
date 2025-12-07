"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import { POLLING, MESSAGES } from "@/lib/constants";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { MessageText } from "@/components/MessageText";
import { StatusBar } from "@/components/StatusBar";
import type { Server, Channel, Message } from "@/bindings/sirc/pkg/irc/models";
import { checkHighlight } from "@/lib/message-parser";
import {
  requestNotificationPermission,
  showMentionNotification,
  showPrivateMessageNotification,
  shouldNotify,
} from "@/lib/notifications";
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/lib/keyboard-shortcuts";

// Dynamic import for components that use Wails bindings
const AddServerDialog = dynamic(() => import("@/components/AddServerDialog").then(m => ({ default: m.AddServerDialog })), { ssr: false });
const JoinChannelDialog = dynamic(() => import("@/components/JoinChannelDialog").then(m => ({ default: m.JoinChannelDialog })), { ssr: false });
const ChannelBrowserDialog = dynamic(() => import("@/components/ChannelBrowserDialog").then(m => ({ default: m.ChannelBrowserDialog })), { ssr: false });
const KeyboardShortcutsDialog = dynamic(() => import("@/components/KeyboardShortcutsDialog").then(m => ({ default: m.KeyboardShortcutsDialog })), { ssr: false });
const SettingsDialog = dynamic(() => import("@/components/SettingsDialog").then(m => ({ default: m.SettingsDialog })), { ssr: false });

// Dynamically import Wails bindings (client-side only)
type IRCServiceBindings = typeof import("@/bindings/sirc/pkg/services/ircservice");
let GetServers: IRCServiceBindings["GetServers"];
let GetChannels: IRCServiceBindings["GetChannels"];
let SendMessage: IRCServiceBindings["SendMessage"];
let GetMessages: IRCServiceBindings["GetMessages"];
let GetConnectionState: IRCServiceBindings["GetConnectionState"];
let Connect: IRCServiceBindings["Connect"];
let Disconnect: IRCServiceBindings["Disconnect"];
let JoinChannel: IRCServiceBindings["JoinChannel"];
let PartChannel: IRCServiceBindings["PartChannel"];
let RemoveServer: IRCServiceBindings["RemoveServer"];
let GetLogs: IRCServiceBindings["GetLogs"];
let GetCurrentNick: IRCServiceBindings["GetCurrentNick"];

export default function Home() {
  const [showAddServer, setShowAddServer] = useState(false);
  const [showJoinChannel, setShowJoinChannel] = useState(false);
  const [showBrowseChannels, setShowBrowseChannels] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [servers, setServers] = useState<(Server | null)[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>("");
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [bindingsLoaded, setBindingsLoaded] = useState(false);
  const [ircLogCollapsed, setIrcLogCollapsed] = useState(false);
  const ircLogPanelRef = useRef<any>(null);

  // Load Wails bindings on client side only
  useEffect(() => {
    import("@/bindings/sirc/pkg/services/ircservice").then((module) => {
      GetServers = module.GetServers;
      GetChannels = module.GetChannels;
      SendMessage = module.SendMessage;
      GetMessages = module.GetMessages;
      GetConnectionState = module.GetConnectionState;
      Connect = module.Connect;
      Disconnect = module.Disconnect;
      PartChannel = module.PartChannel;
      RemoveServer = module.RemoveServer;
      GetLogs = module.GetLogs;
      JoinChannel = module.JoinChannel;
      GetCurrentNick = module.GetCurrentNick;
      setBindingsLoaded(true);
    });
  }, []);

  const loadServers = async (selectServerId?: string) => {
    if (!bindingsLoaded) return;
    try {
      const serverList = await GetServers();
      setServers(serverList);
      if (selectServerId) {
        // Auto-select the specified server
        setActiveServerId(selectServerId);
      } else if (serverList.length > 0 && serverList[0] && !activeServerId) {
        // Only auto-select first server if no server is currently selected
        setActiveServerId(serverList[0].id);
      }
    } catch (error) {
      console.error("Failed to load servers:", error);
    }
  };

  useEffect(() => {
    if (bindingsLoaded) {
      loadServers();
    }
  }, [bindingsLoaded]);

  // Listen for native menu events
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    const handleOpenKeyboardShortcuts = () => setShowKeyboardShortcuts(true);

    let cleanupFns: Array<() => void> = [];

    // Initialize Wails runtime and set up event listeners
    (async () => {
      try {
        const { initializeWailsRuntime } = await import("@/lib/wails-runtime");
        const Events = await initializeWailsRuntime();

        if (Events) {
          cleanupFns.push(Events.On("open-settings", handleOpenSettings));
          cleanupFns.push(Events.On("open-keyboard-shortcuts", handleOpenKeyboardShortcuts));
        }
      } catch (error) {
        console.error("Failed to initialize Wails events:", error);
      }
    })();

    // Cleanup on unmount
    return () => {
      cleanupFns.forEach(cleanup => cleanup());
    };
  }, []);

  // Helper to get all channels across all servers
  const getAllChannels = useCallback(() => {
    const allChannels: Array<{ serverId: string; channel: string }> = [];
    for (const server of servers) {
      if (!server) continue;
      // This would need GetChannels to be called, but we'll implement a simpler version
      // For now, just track the active channel
    }
    return allChannels;
  }, [servers]);

  // Helper to switch to next/previous channel
  const switchChannel = useCallback((direction: "next" | "prev") => {
    if (!activeServerId) return;

    const activeServer = servers.find((s) => s?.id === activeServerId);
    if (!activeServer) return;

    // This is a simplified version - in a real implementation we'd need to
    // fetch the channels and switch between them
    console.log(`[Keyboard] Switch channel ${direction}`);
  }, [activeServerId, servers]);

  // Helper to part current channel
  const partCurrentChannel = useCallback(async () => {
    if (!activeServerId || !activeChannel || !PartChannel) return;

    try {
      await PartChannel(activeServerId, activeChannel);
      setActiveChannel("");
    } catch (error) {
      console.error("Failed to part channel:", error);
    }
  }, [activeServerId, activeChannel]);

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    {
      key: "ArrowUp",
      ctrl: true,
      description: "Switch to previous channel",
      category: "Navigation",
      handler: () => switchChannel("prev"),
    },
    {
      key: "ArrowDown",
      ctrl: true,
      description: "Switch to next channel",
      category: "Navigation",
      handler: () => switchChannel("next"),
    },

    // Actions
    {
      key: "t",
      ctrl: true,
      description: "Add new server",
      category: "Actions",
      handler: () => setShowAddServer(true),
    },
    {
      key: "j",
      ctrl: true,
      description: "Join channel",
      category: "Actions",
      handler: () => {
        if (activeServerId) {
          setShowJoinChannel(true);
        }
      },
    },
    {
      key: "b",
      ctrl: true,
      description: "Browse channels",
      category: "Actions",
      handler: () => {
        if (activeServerId) {
          setShowBrowseChannels(true);
        }
      },
    },
    {
      key: "w",
      ctrl: true,
      description: "Part current channel",
      category: "Actions",
      handler: partCurrentChannel,
    },

    // View
    {
      key: "l",
      ctrl: true,
      description: "Toggle IRC log",
      category: "View",
      handler: () => setIrcLogCollapsed((prev) => !prev),
    },

    // Help
    {
      key: "/",
      ctrl: true,
      description: "Show keyboard shortcuts",
      category: "Help",
      handler: () => setShowKeyboardShortcuts((prev) => !prev),
    },
    {
      key: ",",
      ctrl: true,
      description: "Open settings",
      category: "Help",
      handler: () => setShowSettings(true),
    },
  ];

  // Register keyboard shortcuts
  useKeyboardShortcuts(shortcuts);

  const activeServer = servers.find((s) => s?.id === activeServerId);

  return (
    <div className="h-full flex flex-col">
      <AddServerDialog
        open={showAddServer}
        onOpenChange={setShowAddServer}
        onServerAdded={(serverId) => loadServers(serverId)}
      />
      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
        shortcuts={shortcuts}
      />
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      {activeServer && (
        <>
          <JoinChannelDialog
            open={showJoinChannel}
            onOpenChange={setShowJoinChannel}
            serverId={activeServer.id}
            serverName={activeServer.name}
            onChannelJoined={(channelName) => {
              setActiveChannel(channelName);
              loadServers();
            }}
          />
          <ChannelBrowserDialog
            open={showBrowseChannels}
            onOpenChange={setShowBrowseChannels}
            serverId={activeServer.id}
            serverName={activeServer.name}
            onChannelSelected={async (channelName) => {
              console.log(`[page.tsx] onChannelSelected called with: ${channelName}`);
              console.log(`[page.tsx] JoinChannel is: ${typeof JoinChannel}`);

              if (!JoinChannel) {
                console.error("[page.tsx] JoinChannel binding not loaded!");
                alert("IRC service not ready. Please wait a moment and try again.");
                return;
              }

              try {
                console.log(`[page.tsx] Calling JoinChannel(${activeServer.id}, ${channelName})`);
                await JoinChannel(activeServer.id, channelName);
                console.log(`[page.tsx] JoinChannel succeeded, refreshing servers...`);
                setActiveChannel(channelName);
                loadServers();
              } catch (error) {
                console.error("[page.tsx] Failed to join channel:", error);
                alert(`Failed to join channel: ${error}`);
              }
            }}
          />
        </>
      )}
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Left: Server/Channel Tree */}
        <ResizablePanel defaultSize={15} minSize={12} maxSize={25}>
          <div className="h-full flex flex-col bg-card">
            <div className="flex-1 overflow-auto p-1 pt-[50px]">
              <ServerTree
                servers={servers}
                activeServerId={activeServerId}
                activeChannel={activeChannel}
                onServerSelect={setActiveServerId}
                onChannelSelect={setActiveChannel}
                onJoinChannel={(serverId) => {
                  setActiveServerId(serverId);
                  setShowJoinChannel(true);
                }}
                onBrowseChannels={(serverId) => {
                  setActiveServerId(serverId);
                  setShowBrowseChannels(true);
                }}
              />
            </div>
            <div className="p-1.5 border-t">
              <button
                onClick={() => setShowAddServer(true)}
                className="w-full px-2 py-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
              >
                + Server
              </button>
            </div>
          </div>
        </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Middle/Right: Main Content Area */}
      <ResizablePanel defaultSize={85}>
        <ResizablePanelGroup direction="vertical">
          {/* Top: Chat + User List */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <ResizablePanelGroup direction="horizontal">
              {/* Chat Area */}
              <ResizablePanel defaultSize={75} minSize={50}>
                <div className="h-full flex flex-col bg-background">
                  {/* Channel Header */}
                  <div className="px-3 py-2 border-b bg-card min-h-[50px] flex items-center">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <h3 className="font-semibold text-xs">{activeChannel || "No channel"}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {activeServer?.host || "Select a channel"}
                        </p>
                      </div>
                      {activeChannel && (
                        <button className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-secondary/80 rounded transition-colors">
                          Info
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-auto p-2">
                    <ChatMessages serverId={activeServerId} channel={activeChannel} />
                  </div>

                  {/* Input */}
                  <div className="p-2 border-t bg-card">
                    <ChatInput
                      serverId={activeServerId}
                      channel={activeChannel}
                      disabled={!activeServerId || !activeChannel}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* User List */}
              <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
                <div className="h-full flex flex-col bg-card border-l">
                  <div className="px-2 py-2 border-b bg-muted/40 min-h-[50px] flex items-center">
                    <div>
                      <h3 className="font-semibold text-xs">USERS</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {activeChannel ? `${activeChannel} users` : "No channel"}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <UserList serverId={activeServerId} channel={activeChannel} />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Bottom: IRC Protocol Log */}
          <ResizablePanel
            ref={ircLogPanelRef}
            defaultSize={30}
            minSize={0}
            maxSize={50}
            collapsedSize={0}
            collapsible={true}
            onCollapse={() => setIrcLogCollapsed(true)}
            onExpand={() => setIrcLogCollapsed(false)}
          >
            <div className="h-full flex flex-col bg-card border-t overflow-hidden">
              <div
                className="px-3 py-1.5 border-b bg-muted/40 flex items-center justify-between flex-shrink-0 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => {
                  if (ircLogPanelRef.current) {
                    if (ircLogCollapsed) {
                      ircLogPanelRef.current.expand();
                    } else {
                      ircLogPanelRef.current.collapse();
                    }
                  }
                }}
              >
                <h3 className="font-semibold text-xs">IRC PROTOCOL LOG</h3>
                <div className="pointer-events-none">
                  {ircLogCollapsed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <IRCLog serverId={activeServerId} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
    <StatusBar servers={servers} activeServerId={activeServerId} activeChannel={activeChannel} />
    </div>
  );
}

interface ServerTreeProps {
  servers: (Server | null)[];
  activeServerId: string;
  activeChannel: string;
  onServerSelect: (serverId: string) => void;
  onChannelSelect: (channel: string) => void;
  onJoinChannel: (serverId: string) => void;
  onBrowseChannels: (serverId: string) => void;
}

function ServerTree({
  servers,
  activeServerId,
  activeChannel,
  onServerSelect,
  onChannelSelect,
  onJoinChannel,
  onBrowseChannels,
}: ServerTreeProps) {
  const [openServers, setOpenServers] = useState<Set<string>>(new Set());
  const [serverChannels, setServerChannels] = useState<Record<string, (Channel | null)[]>>({});
  const [connectionStates, setConnectionStates] = useState<Record<string, string>>({});

  useEffect(() => {
    // Auto-expand first server on initial load
    if (servers.length > 0 && servers[0] && openServers.size === 0) {
      setOpenServers(new Set([servers[0].id]));
    }
  }, [servers]);

  // Auto-expand active server when it changes
  useEffect(() => {
    if (activeServerId && !openServers.has(activeServerId)) {
      setOpenServers((prev) => new Set([...prev, activeServerId]));
    }
  }, [activeServerId]);

  // Poll for channels (refresh every 1 second)
  useEffect(() => {
    if (!GetChannels || openServers.size === 0) return;

    const loadChannels = async () => {
      for (const serverId of openServers) {
        try {
          const channels = await GetChannels(serverId);
          // Sort channels alphabetically by name (case-insensitive)
          const sortedChannels = [...channels].sort((a, b) => {
            if (!a || !b) return 0;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          });
          setServerChannels((prev) => ({ ...prev, [serverId]: sortedChannels }));
        } catch (error) {
          console.debug(`Failed to load channels for ${serverId}:`, error);
          setServerChannels((prev) => ({ ...prev, [serverId]: [] }));
        }
      }
    };

    // Load immediately
    loadChannels();

    // Then poll using the constant interval
    const interval = setInterval(loadChannels, POLLING.CHANNELS);
    return () => clearInterval(interval);
  }, [openServers, GetChannels]);

  // Poll for connection status
  useEffect(() => {
    if (!GetConnectionState || servers.length === 0) return;

    const updateConnectionStates = async () => {
      for (const server of servers) {
        if (!server) continue;
        try {
          const state = await GetConnectionState(server.id);
          setConnectionStates((prev) => ({ ...prev, [server.id]: state }));
        } catch (error) {
          console.debug(`Failed to get connection state for ${server.id}:`, error);
        }
      }
    };

    updateConnectionStates();
    const interval = setInterval(updateConnectionStates, POLLING.CONNECTION_STATE);
    return () => clearInterval(interval);
  }, [servers, GetConnectionState]);

  const toggleServer = (serverId: string) => {
    setOpenServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
    onServerSelect(serverId);
    // Clear active channel to show server status window
    onChannelSelect("");
  };

  if (servers.length === 0) {
    return (
      <div className="text-center text-[11px] text-muted-foreground py-4">
        No servers
      </div>
    );
  }

  // Helper to get status color
  const getStatusColor = (state: string) => {
    switch (state) {
      case "registered":
        return "bg-green-500";
      case "connected":
      case "connecting":
        return "bg-yellow-500";
      case "disconnected":
      default:
        return "bg-red-500";
    }
  };

  // Handler functions for context menu actions
  const handleConnect = async (serverId: string) => {
    if (!Connect) return;
    try {
      await Connect(serverId);
    } catch (error) {
      console.error(`Failed to connect to ${serverId}:`, error);
      alert(`Failed to connect: ${error}`);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    if (!Disconnect) return;
    try {
      await Disconnect(serverId);
    } catch (error) {
      console.error(`Failed to disconnect from ${serverId}:`, error);
      alert(`Failed to disconnect: ${error}`);
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    if (!RemoveServer) return;
    if (!confirm("Are you sure you want to remove this server?")) return;
    try {
      await RemoveServer(serverId);
      // Refresh the server list
      window.location.reload();
    } catch (error) {
      console.error(`Failed to remove server ${serverId}:`, error);
      alert(`Failed to remove server: ${error}`);
    }
  };

  const handlePartChannel = async (serverId: string, channelName: string) => {
    if (!PartChannel) return;
    try {
      await PartChannel(serverId, channelName);
    } catch (error) {
      console.error(`Failed to part channel ${channelName}:`, error);
      alert(`Failed to part channel: ${error}`);
    }
  };

  return (
    <div className="space-y-0.5">
      {servers.map((server) => {
        if (!server) return null;
        const channels = serverChannels[server.id] || [];
        const status = connectionStates[server.id] || "disconnected";
        const isConnected = status === "registered" || status === "connected";

        return (
          <Collapsible
            key={server.id}
            open={openServers.has(server.id)}
            onOpenChange={() => toggleServer(server.id)}
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <CollapsibleTrigger className="w-full text-left px-1.5 py-1 rounded hover:bg-accent text-[11px] font-medium transition-colors flex items-center gap-1">
                  <span className="text-[9px]">{openServers.has(server.id) ? "▼" : "▶"}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status)}`} title={status}></span>
                  <span>{server.name}</span>
                </CollapsibleTrigger>
              </ContextMenuTrigger>
              <ContextMenuContent className="text-[11px]">
                {!isConnected ? (
                  <ContextMenuItem onClick={() => handleConnect(server.id)}>
                    Connect
                  </ContextMenuItem>
                ) : (
                  <>
                    <ContextMenuItem onClick={() => handleDisconnect(server.id)}>
                      Disconnect
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onJoinChannel(server.id)}>
                      Join Channel...
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onBrowseChannels(server.id)}>
                      Browse Channels...
                    </ContextMenuItem>
                  </>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleRemoveServer(server.id)}>
                  Remove Server
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            <CollapsibleContent className="ml-3 space-y-0.5 mt-0.5">
              {channels.length === 0 ? (
                <div className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  No channels
                </div>
              ) : (
                channels.map((channel) => {
                  if (!channel) return null;
                  return (
                    <ContextMenu key={channel.name}>
                      <ContextMenuTrigger>
                        <button
                          onClick={() => onChannelSelect(channel.name)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                            activeChannel === channel.name && activeServerId === server.id
                              ? "bg-accent"
                              : "hover:bg-accent text-muted-foreground"
                          }`}
                        >
                          {channel.name}
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="text-[11px]">
                        <ContextMenuItem onClick={() => handlePartChannel(server.id, channel.name)}>
                          Part Channel
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

interface ChatInputProps {
  serverId: string;
  channel: string;
  disabled?: boolean;
}

function ChatInput({ serverId, channel, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || sending || !SendMessage) return;

    setSending(true);
    try {
      await SendMessage(serverId, channel, message);
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(`Failed to send message: ${error}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="flex gap-1.5">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={disabled ? "Select channel..." : "Message or /msg Bot xdcc send #pack"}
        disabled={disabled || sending}
        className="flex-1 px-2 py-1 text-[11px] bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || sending || !message.trim()}
        className="px-3 py-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? "..." : "Send"}
      </button>
    </form>
  );
}

interface ChatMessagesProps {
  serverId: string;
  channel: string;
}

function ChatMessages({ serverId, channel }: ChatMessagesProps) {
  const [messages, setMessages] = useState<(Message | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentNick, setCurrentNick] = useState<string>("");
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);

  // Request notification permission on mount
  useEffect(() => {
    if (!notificationPermissionRequested) {
      requestNotificationPermission().then((granted) => {
        if (granted) {
          console.log("[Notifications] Permission granted");
        } else {
          console.log("[Notifications] Permission denied or not supported");
        }
      });
      setNotificationPermissionRequested(true);
    }
  }, [notificationPermissionRequested]);

  // Fetch current user's nickname
  useEffect(() => {
    if (!serverId || !GetCurrentNick) {
      setCurrentNick("");
      return;
    }

    const fetchNick = async () => {
      try {
        const nick = await GetCurrentNick(serverId);
        setCurrentNick(nick);
      } catch (error) {
        console.debug("Failed to fetch current nick:", error);
        setCurrentNick("");
      }
    };

    fetchNick();
  }, [serverId, GetCurrentNick]);

  // Fetch messages from backend
  const fetchMessages = useCallback(async () => {
    if (!serverId || !channel || !GetMessages) {
      setMessages([]);
      return;
    }

    try {
      const msgs = await GetMessages(serverId, channel);

      // Check for new messages and trigger notifications
      if (currentNick && msgs.length > previousMessageCount) {
        // Only check the new messages (messages after previousMessageCount)
        const newMessages = msgs.slice(previousMessageCount);

        for (const msg of newMessages) {
          if (!msg || msg.from === currentNick) continue; // Skip own messages

          // Check if message contains a mention or is a private message
          const isPM = !channel.startsWith("#");
          const highlight = checkHighlight(msg.text, currentNick, []);

          // Determine if we should notify
          if (shouldNotify(highlight.isMention || isPM, highlight.isKeyword)) {
            if (isPM) {
              showPrivateMessageNotification(msg.from, msg.text);
            } else if (highlight.isMention) {
              showMentionNotification(msg.from, channel, msg.text);
            }
          }
        }
      }

      // Prune messages if they exceed the limit
      let prunedMessages = msgs;
      if (msgs.length > MESSAGES.MAX_DISPLAYED) {
        // Keep only the most recent PRUNE_TO messages
        prunedMessages = msgs.slice(msgs.length - MESSAGES.PRUNE_TO);
        console.log(`[ChatMessages] Pruned messages from ${msgs.length} to ${prunedMessages.length}`);
      }

      // Only update state if the message count changed (avoids unnecessary re-renders)
      if (prunedMessages.length !== lastMessageCountRef.current) {
        lastMessageCountRef.current = prunedMessages.length;
        setPreviousMessageCount(prunedMessages.length);
        setMessages(prunedMessages);
      }
    } catch (error) {
      // Channel might not be joined yet or no messages, that's ok
      console.debug("Failed to fetch messages:", error);
      setMessages([]);
    }
  }, [serverId, channel, GetMessages, currentNick, previousMessageCount]);

  // Reset message count when channel changes
  useEffect(() => {
    setPreviousMessageCount(0);
    lastMessageCountRef.current = 0;
    setMessages([]);
  }, [serverId, channel]);

  // Initial load
  useEffect(() => {
    if (!GetMessages) return;
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
  }, [GetMessages, fetchMessages]);

  // Listen for real-time message events from backend
  useEffect(() => {
    if (!serverId || !channel) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { initializeWailsRuntime } = await import("@/lib/wails-runtime");
        const Events = await initializeWailsRuntime();

        if (Events) {
          cleanup = Events.On("irc:message", (data: any) => {
            // Only process messages for the active channel
            if (data.serverId === serverId && data.channel === channel) {
              // Append new message instead of re-fetching everything
              setMessages((prev) => {
                const newMessages = [...prev, data.message];
                // Prune if needed
                if (newMessages.length > MESSAGES.MAX_DISPLAYED) {
                  return newMessages.slice(newMessages.length - MESSAGES.PRUNE_TO);
                }
                return newMessages;
              });
              setPreviousMessageCount((prev) => prev + 1);
              lastMessageCountRef.current += 1;
            }
          });
        }
      } catch (error) {
        console.error("Failed to set up message event listener:", error);
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [serverId, channel]);

  // Auto-scroll to bottom when new messages arrive (only if we're near the bottom)
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages.length]);

  // Memoize rendered messages to prevent re-renders during polling
  const renderedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
      if (!msg) return null;
      const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      // Use a stable key based on timestamp + from + text to prevent re-renders
      const stableKey = `${msg.timestamp}-${msg.from}-${idx}`;
      return (
        <div key={stableKey} className="px-1 py-0.5 hover:bg-accent/50 rounded text-[11px]">
          <span className="text-[10px] text-muted-foreground">{time}</span>
          <span className="mx-1.5 font-medium text-primary">{msg.from}:</span>
          <MessageText
            text={msg.text}
            className="text-foreground"
            currentNick={currentNick}
          />
        </div>
      );
    });
  }, [messages, currentNick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  if (!serverId || !channel) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        Select a channel to view messages
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        <div className="text-center space-y-1">
          <p>No messages yet</p>
          <p className="text-[10px]">Messages will appear here as they arrive</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {renderedMessages}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface UserListProps {
  serverId: string;
  channel: string;
}

function UserList({ serverId, channel }: UserListProps) {
  const [users, setUsers] = useState<string[]>([]);
  const [GetChannels, setGetChannels] = useState<any>(null);

  // Dynamically import Wails bindings (client-side only)
  useEffect(() => {
    import("@/bindings/sirc/pkg/services/ircservice").then((module) => {
      setGetChannels(() => module.GetChannels);
    });
  }, []);

  // Fetch user list from channel data
  useEffect(() => {
    if (!serverId || !channel || !GetChannels) {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      try {
        const channels = await GetChannels(serverId);
        const currentChannel = channels.find((ch: any) => ch.name === channel);
        if (currentChannel && currentChannel.userList) {
          setUsers(currentChannel.userList);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error("Failed to fetch user list:", error);
        setUsers([]);
      }
    };

    fetchUsers();

    // Poll for updates using the constant interval
    const interval = setInterval(fetchUsers, POLLING.USER_LIST);
    return () => clearInterval(interval);
  }, [serverId, channel, GetChannels]);

  if (!serverId || !channel) {
    return (
      <div className="p-2 text-center text-[11px] text-muted-foreground">
        Select a channel to view users
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-2 text-center text-[11px] text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <div className="p-1">
      {users.map((user, i) => {
        // Extract mode prefix if present
        const modePrefix = user.match(/^[@+%&~!]/)?.[0] || '';
        const nickname = modePrefix ? user.slice(1) : user;

        // Debug logging
        if (i < 5) {
          console.log(`[UserList] User ${i}: "${user}" -> prefix:"${modePrefix}" nick:"${nickname}"`);
        }

        // Color coding for different modes
        const modeColor = {
          '@': 'text-yellow-500',  // Op
          '+': 'text-blue-500',     // Voice
          '%': 'text-purple-500',   // Half-op
          '&': 'text-red-500',      // Admin
          '~': 'text-pink-500',     // Owner
          '!': 'text-orange-500',   // Special
        }[modePrefix] || '';

        return (
          <div
            key={`${user}-${i}`}
            className="px-2 py-0.5 text-[11px] font-mono hover:bg-muted/50 rounded"
          >
            {modePrefix && (
              <span className={`font-bold ${modeColor}`}>{modePrefix}</span>
            )}
            <span className="text-foreground">{nickname}</span>
          </div>
        );
      })}
    </div>
  );
}

interface IRCLogProps {
  serverId: string;
}

function IRCLog({ serverId }: IRCLogProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [GetLogs, setGetLogs] = useState<any>(null);

  // Dynamically import Wails bindings (client-side only)
  useEffect(() => {
    import("@/bindings/sirc/pkg/services/ircservice").then((module) => {
      setGetLogs(() => module.GetLogs);
    });
  }, []);

  // Fetch logs from backend
  const fetchLogs = async () => {
    if (!serverId || !GetLogs) {
      setLogs([]);
      return;
    }

    try {
      const logEntries = await GetLogs(serverId);
      setLogs(logEntries);
    } catch (error) {
      console.debug("Failed to fetch logs:", error);
      setLogs([]);
    }
  };

  // Initial load
  useEffect(() => {
    if (!GetLogs) return;
    fetchLogs();
  }, [serverId, GetLogs]);

  // Listen for real-time log events from backend
  useEffect(() => {
    if (!serverId) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { initializeWailsRuntime } = await import("@/lib/wails-runtime");
        const Events = await initializeWailsRuntime();

        if (Events) {
          console.log("[IRCLog] Setting up irc:log event listener for", serverId);
          cleanup = Events.On("irc:log", (data: any) => {
            console.log("[IRCLog] Received irc:log event:", data);
            // Only process logs for the active server
            if (data.serverId === serverId) {
              console.log("[IRCLog] Appending log entry to state");
              // Append new log entry
              setLogs((prev) => {
                const newLogs = [...prev, data.entry];
                console.log("[IRCLog] New logs count:", newLogs.length);
                return newLogs;
              });
            }
          });
          console.log("[IRCLog] Event listener setup complete");
        }
      } catch (error) {
        console.error("Failed to set up log event listener:", error);
      }
    })();

    return () => {
      if (cleanup) {
        console.log("[IRCLog] Cleaning up event listener");
        cleanup();
      }
    };
  }, [serverId]);

  if (!serverId) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        <div className="text-center space-y-1">
          <p>Select a server to view IRC logs</p>
          <p className="text-[10px]">Protocol messages will appear here</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        <div className="text-center space-y-1">
          <p>No IRC logs yet</p>
          <p className="text-[10px]">Connect to server to see protocol messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-0.5 font-mono text-[10px] overflow-auto">
      {logs.map((log, idx) => {
        if (!log) return null;
        const time = new Date(log.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const getLogColor = () => {
          if (log.type === "error") return "text-red-500";
          if (log.type === "info") return "text-green-500";
          if (log.direction === "in") return "text-blue-400";
          if (log.direction === "out") return "text-yellow-400";
          return "text-muted-foreground";
        };

        const getPrefix = () => {
          if (log.type === "error") return "[ERROR]";
          if (log.type === "info") return "[INFO]";
          if (log.direction === "in") return "<<";
          if (log.direction === "out") return ">>";
          return "";
        };

        return (
          <div key={idx} className={`${getLogColor()}`}>
            <span className="text-muted-foreground">[{time}]</span>{" "}
            <span className="font-bold">{getPrefix()}</span>{" "}
            <span>{log.raw}</span>
          </div>
        );
      })}
    </div>
  );
}
