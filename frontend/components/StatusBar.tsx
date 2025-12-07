"use client";

import { useState, useEffect } from "react";
import type { Server } from "@/bindings/sirc/pkg/irc/models";

interface StatusBarProps {
  servers: (Server | null)[];
  activeServerId: string;
  activeChannel: string;
}

export function StatusBar({ servers, activeServerId, activeChannel }: StatusBarProps) {
  const [memoryUsage, setMemoryUsage] = useState<string>("--");
  const [connectedServers, setConnectedServers] = useState<number>(0);
  const [totalChannels, setTotalChannels] = useState<number>(0);

  // Calculate connected servers and total channels
  useEffect(() => {
    let connected = 0;
    let channels = 0;

    // This would need to check actual connection states
    // For now, just count non-null servers as potentially connected
    servers.forEach((server) => {
      if (server) {
        connected++;
        // We'd need to fetch channel count per server here
      }
    });

    setConnectedServers(connected);
    setTotalChannels(channels);
  }, [servers]);

  // Get memory usage if available
  useEffect(() => {
    // Browser memory API is limited, but we can show process info if available
    if (typeof performance !== "undefined" && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
      setMemoryUsage(`${usedMB} MB`);
    }
  }, []);

  return (
    <div className="h-6 bg-muted/40 border-t flex items-center px-3 text-[10px] text-muted-foreground gap-4 flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">Memory:</span>
        <span>{memoryUsage}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-medium">Servers:</span>
        <span>{servers.filter((s) => s !== null).length}</span>
      </div>
      {activeServerId && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Active:</span>
          <span>{activeServerId}</span>
        </div>
      )}
      {activeChannel && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">Channel:</span>
          <span>{activeChannel}</span>
        </div>
      )}
    </div>
  );
}
