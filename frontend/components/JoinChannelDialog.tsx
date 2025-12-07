"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoinChannel } from "@/bindings/sirc/pkg/services/ircservice";
import { ChannelBrowserDialog } from "./ChannelBrowserDialog";

interface JoinChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
  onChannelJoined?: (channelName: string) => void;
}

export function JoinChannelDialog({
  open,
  onOpenChange,
  serverId,
  serverName,
  onChannelJoined,
}: JoinChannelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure channel starts with #
      const channelName = channel.startsWith("#") ? channel : `#${channel}`;

      // Join channel on server
      await JoinChannel(serverId, channelName);

      // Reset form and close dialog
      setChannel("");
      onOpenChange(false);
      onChannelJoined?.(channelName);
    } catch (error) {
      console.error("Failed to join channel:", error);
      alert(`Failed to join channel: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelected = async (channelName: string) => {
    setLoading(true);
    try {
      await JoinChannel(serverId, channelName);
      setChannel("");
      onOpenChange(false);
      onChannelJoined?.(channelName);
    } catch (error) {
      console.error("Failed to join channel:", error);
      alert(`Failed to join channel: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Join Channel</DialogTitle>
          <DialogDescription>
            Join a channel on {serverName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="channel">Channel Name</Label>
              <div className="flex gap-2">
                <Input
                  id="channel"
                  placeholder="anime-downloads"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  required
                  autoFocus
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBrowser(true)}
                  disabled={loading}
                >
                  Browse...
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The # symbol will be added automatically if omitted
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Joining..." : "Join Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ChannelBrowserDialog
        open={showBrowser}
        onOpenChange={setShowBrowser}
        serverId={serverId}
        serverName={serverName}
        onChannelSelected={handleChannelSelected}
      />
    </Dialog>
  );
}
