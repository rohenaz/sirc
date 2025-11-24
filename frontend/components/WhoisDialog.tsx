/**
 * WhoisDialog component - Displays WHOIS information about IRC users
 */

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface WhoisInfo {
  nick: string;
  username: string;
  host: string;
  realName: string;
  server: string;
  serverInfo: string;
  channels: string[];
  account: string;
  isOperator: boolean;
  idleTime: number; // seconds
  signOnTime: number; // unix timestamp
}

interface WhoisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nickname: string;
  onWhoisRequest?: (nick: string) => void;
}

/**
 * Formats seconds into human-readable time
 */
function formatIdleTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Formats unix timestamp into readable date/time
 */
function formatSignOnTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * WHOIS information display dialog
 */
export function WhoisDialog({
  open,
  onOpenChange,
  nickname,
  onWhoisRequest,
}: WhoisDialogProps) {
  const [whoisInfo, setWhoisInfo] = useState<WhoisInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && nickname) {
      setLoading(true);
      setError(null);
      setWhoisInfo(null);

      // Request WHOIS information
      if (onWhoisRequest) {
        onWhoisRequest(nickname);
      }

      // In a real implementation, we would listen for WHOIS updates from the backend
      // For now, simulate a delay and set mock data
      // TODO: Replace with actual Wails event listener for WHOIS data
      setTimeout(() => {
        // This would be replaced with actual data from GetWhoisInfo() service call
        setLoading(false);
      }, 1000);
    }
  }, [open, nickname, onWhoisRequest]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WHOIS Information</DialogTitle>
          <DialogDescription>
            User information for {nickname}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-muted-foreground">
            Loading WHOIS information...
          </div>
        )}

        {error && (
          <div className="py-4 text-center text-destructive">
            Error: {error}
          </div>
        )}

        {!loading && !error && whoisInfo && (
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Basic Information
              </h3>
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <div className="font-medium">Nickname:</div>
                <div className="font-mono">{whoisInfo.nick}</div>

                <div className="font-medium">Username:</div>
                <div className="font-mono">{whoisInfo.username}</div>

                <div className="font-medium">Host:</div>
                <div className="font-mono break-all">{whoisInfo.host}</div>

                {whoisInfo.realName && (
                  <>
                    <div className="font-medium">Real Name:</div>
                    <div>{whoisInfo.realName}</div>
                  </>
                )}

                {whoisInfo.account && (
                  <>
                    <div className="font-medium">Account:</div>
                    <div className="font-mono">{whoisInfo.account}</div>
                  </>
                )}

                {whoisInfo.isOperator && (
                  <>
                    <div className="font-medium">Status:</div>
                    <div className="text-primary font-medium">
                      IRC Operator
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Server Information */}
            {whoisInfo.server && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Server Information
                  </h3>
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    <div className="font-medium">Server:</div>
                    <div className="font-mono">{whoisInfo.server}</div>

                    {whoisInfo.serverInfo && (
                      <>
                        <div className="font-medium">Info:</div>
                        <div>{whoisInfo.serverInfo}</div>
                      </>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Activity Information */}
            {(whoisInfo.idleTime > 0 || whoisInfo.signOnTime > 0) && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Activity
                  </h3>
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                    {whoisInfo.idleTime > 0 && (
                      <>
                        <div className="font-medium">Idle Time:</div>
                        <div>{formatIdleTime(whoisInfo.idleTime)}</div>
                      </>
                    )}

                    {whoisInfo.signOnTime > 0 && (
                      <>
                        <div className="font-medium">Sign-On Time:</div>
                        <div>{formatSignOnTime(whoisInfo.signOnTime)}</div>
                      </>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Channels */}
            {whoisInfo.channels && whoisInfo.channels.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Channels ({whoisInfo.channels.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {whoisInfo.channels.map((channel, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-muted rounded-md font-mono text-sm"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* No data message */}
            {!whoisInfo.username &&
              !whoisInfo.server &&
              whoisInfo.channels.length === 0 && (
                <div className="py-4 text-center text-muted-foreground">
                  No WHOIS information available for {nickname}
                </div>
              )}
          </div>
        )}

        {!loading && !error && !whoisInfo && (
          <div className="py-8 text-center text-muted-foreground">
            No WHOIS information available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
