"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import type { Server, Channel, Message } from "@/bindings/sirc/pkg/irc/models";

// Dynamic import for components that use Wails bindings
const AddServerDialog = dynamic(() => import("@/components/AddServerDialog").then(m => ({ default: m.AddServerDialog })), { ssr: false });
const JoinChannelDialog = dynamic(() => import("@/components/JoinChannelDialog").then(m => ({ default: m.JoinChannelDialog })), { ssr: false });
const ChannelBrowserDialog = dynamic(() => import("@/components/ChannelBrowserDialog").then(m => ({ default: m.ChannelBrowserDialog })), { ssr: false });

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
  const [servers, setServers] = useState<(Server | null)[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>("");
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [bindingsLoaded, setBindingsLoaded] = useState(false);
  const [ircLogCollapsed, setIrcLogCollapsed] = useState(false);

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

  const loadServers = async () => {
    if (!bindingsLoaded) return;
    try {
      const serverList = await GetServers();
      setServers(serverList);
      if (serverList.length > 0 && serverList[0]) {
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

  const activeServer = servers.find((s) => s?.id === activeServerId);

  return (
    <>
      <AddServerDialog
        open={showAddServer}
        onOpenChange={setShowAddServer}
        onServerAdded={loadServers}
      />
      {activeServer && (
        <>
          <JoinChannelDialog
            open={showJoinChannel}
            onOpenChange={setShowJoinChannel}
            serverId={activeServer.id}
            serverName={activeServer.name}
            onChannelJoined={loadServers}
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
          <div className="h-full flex flex-col bg-card border-r">
            <div className="px-2 py-1.5 border-b bg-muted/40">
              <h2 className="font-semibold text-xs">SERVERS</h2>
            </div>
            <div className="flex-1 overflow-auto p-1">
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
                  <div className="px-3 py-1.5 border-b bg-card">
                    <div className="flex items-center justify-between">
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
                  <div className="px-2 py-1.5 border-b bg-muted/40">
                    <h3 className="font-semibold text-xs">USERS</h3>
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
            defaultSize={ircLogCollapsed ? 5 : 30}
            minSize={5}
            maxSize={50}
            collapsible={true}
            onCollapse={() => setIrcLogCollapsed(true)}
            onExpand={() => setIrcLogCollapsed(false)}
          >
            <div className="h-full flex flex-col bg-card border-t">
              <div
                className="px-3 py-1.5 border-b bg-muted/40 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => setIrcLogCollapsed(!ircLogCollapsed)}
              >
                <h3 className="font-semibold text-xs">IRC PROTOCOL LOG</h3>
                <Button variant="ghost" className="h-5 w-5 p-0">
                  {ircLogCollapsed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!ircLogCollapsed && (
                <div className="flex-1 overflow-auto">
                  <IRCLog serverId={activeServerId} />
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
    </>
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
    // Auto-expand first server
    if (servers.length > 0 && servers[0]) {
      setOpenServers(new Set([servers[0].id]));
    }
  }, [servers]);

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

    // Then poll every 1 second
    const interval = setInterval(loadChannels, 1000);
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
    const interval = setInterval(updateConnectionStates, 1000);
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
  const fetchMessages = async () => {
    if (!serverId || !channel || !GetMessages) {
      setMessages([]);
      return;
    }

    try {
      const msgs = await GetMessages(serverId, channel);
      setMessages(msgs);
    } catch (error) {
      // Channel might not be joined yet or no messages, that's ok
      console.debug("Failed to fetch messages:", error);
      setMessages([]);
    }
  };

  // Initial load
  useEffect(() => {
    if (!GetMessages) return;
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
  }, [serverId, channel, GetMessages]);

  // Poll for new messages every 1 second
  useEffect(() => {
    if (!serverId || !channel || !GetMessages) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, 1000);

    return () => clearInterval(interval);
  }, [serverId, channel, GetMessages]);

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
      {messages.map((msg, idx) => {
        if (!msg) return null;
        const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <div key={idx} className="px-1 py-0.5 hover:bg-accent/50 rounded text-[11px]">
            <span className="text-[10px] text-muted-foreground">{time}</span>
            <span className="mx-1.5 font-medium text-primary">{msg.from}:</span>
            <MessageText
              text={msg.text}
              className="text-foreground"
              currentNick={currentNick}
            />
          </div>
        );
      })}
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

    // Poll for updates every 2 seconds
    const interval = setInterval(fetchUsers, 2000);
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

  // Poll for new logs every 1 second
  useEffect(() => {
    if (!serverId || !GetLogs) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 1000);

    return () => clearInterval(interval);
  }, [serverId, GetLogs]);

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
