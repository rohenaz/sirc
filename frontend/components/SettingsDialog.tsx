"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Settings types (matching Go backend)
interface NotificationSettings {
  enabled: boolean;
  mentionsOnly: boolean;
  keywords: string[];
  sound: boolean;
  notifyWhenFocused: boolean;
}

interface ReconnectSettings {
  enabled: boolean;
  maxAttempts: number;
  maxBackoff: number;
}

interface InterfaceSettings {
  theme: string;
  fontSize: number;
  showTimestamps: boolean;
  show24HourTime: boolean;
  showUserList: boolean;
  showIRCLog: boolean;
  compactMode: boolean;
  animatedAvatars: boolean;
}

interface ChatSettings {
  maxMessages: number;
  maxLogs: number;
  autoFocusInput: boolean;
  showJoinPart: boolean;
  showQuit: boolean;
  clickableURLs: boolean;
  inlineImages: boolean;
  emojiEnabled: boolean;
  commandHistory: number;
  defaultQuitMsg: string;
  defaultPartMsg: string;
}

interface DownloadSettings {
  downloadPath: string;
  maxConcurrent: number;
  autoAccept: boolean;
  autoRetry: boolean;
  maxRetries: number;
  speedLimitKBps: number;
  notifyOnComplete: boolean;
  notifyOnFail: boolean;
}

interface SecuritySettings {
  verifyCertificates: boolean;
  allowDCC: boolean;
  allowCTCP: boolean;
  ignoreList: string[];
}

interface Settings {
  notifications: NotificationSettings;
  reconnect: ReconnectSettings;
  interface: InterfaceSettings;
  chat: ChatSettings;
  download: DownloadSettings;
  security: SecuritySettings;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [GetSettings, setGetSettings] = useState<any>(null);
  const [SaveSettings, setSaveSettings] = useState<any>(null);

  // Load Wails bindings
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@/bindings/sirc/pkg/services/settingsservice")
        .then((module) => {
          setGetSettings(() => module.GetSettings);
          setSaveSettings(() => module.SaveSettings);
        })
        .catch((err) => console.error("Failed to load settings bindings:", err));
    }
  }, []);

  // Load settings when dialog opens
  useEffect(() => {
    if (open && GetSettings) {
      setLoading(true);
      GetSettings()
        .then((loadedSettings: Settings) => {
          setSettings(loadedSettings);
          setLoading(false);
        })
        .catch((err: Error) => {
          console.error("Failed to load settings:", err);
          setLoading(false);
        });
    }
  }, [open, GetSettings]);

  const handleSave = async () => {
    if (!settings || !SaveSettings) return;

    setSaving(true);
    try {
      await SaveSettings(settings);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateNotifications = (updates: Partial<NotificationSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, ...updates },
    });
  };

  const updateReconnect = (updates: Partial<ReconnectSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      reconnect: { ...settings.reconnect, ...updates },
    });
  };

  const updateInterface = (updates: Partial<InterfaceSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      interface: { ...settings.interface, ...updates },
    });
  };

  const updateChat = (updates: Partial<ChatSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      chat: { ...settings.chat, ...updates },
    });
  };

  const updateDownload = (updates: Partial<DownloadSettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      download: { ...settings.download, ...updates },
    });
  };

  const updateSecurity = (updates: Partial<SecuritySettings>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      security: { ...settings.security, ...updates },
    });
  };

  if (loading || !settings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Loading settings...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure SIRC to your preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="interface">Interface</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="downloads">Downloads</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications-enabled"
                  checked={settings.notifications.enabled}
                  onCheckedChange={(checked) =>
                    updateNotifications({ enabled: !!checked })
                  }
                />
                <Label htmlFor="notifications-enabled">
                  Enable desktop notifications
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mentions-only"
                  checked={settings.notifications.mentionsOnly}
                  onCheckedChange={(checked) =>
                    updateNotifications({ mentionsOnly: !!checked })
                  }
                />
                <Label htmlFor="mentions-only">
                  Only notify for mentions and private messages
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify-focused"
                  checked={settings.notifications.notifyWhenFocused}
                  onCheckedChange={(checked) =>
                    updateNotifications({ notifyWhenFocused: !!checked })
                  }
                />
                <Label htmlFor="notify-focused">
                  Show notifications when window is focused
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notification-sound"
                  checked={settings.notifications.sound}
                  onCheckedChange={(checked) =>
                    updateNotifications({ sound: !!checked })
                  }
                />
                <Label htmlFor="notification-sound">Play sound on notification</Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="keywords">Highlight keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={settings.notifications.keywords.join(", ")}
                  onChange={(e) =>
                    updateNotifications({
                      keywords: e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter((k) => k),
                    })
                  }
                  placeholder="urgent, help, question"
                />
                <p className="text-xs text-muted-foreground">
                  Get notified when these words appear in messages
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-semibold">Auto-Reconnect</h3>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reconnect-enabled"
                  checked={settings.reconnect.enabled}
                  onCheckedChange={(checked) =>
                    updateReconnect({ enabled: !!checked })
                  }
                />
                <Label htmlFor="reconnect-enabled">
                  Automatically reconnect on disconnect
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-attempts">Maximum reconnect attempts</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  value={settings.reconnect.maxAttempts}
                  onChange={(e) =>
                    updateReconnect({ maxAttempts: parseInt(e.target.value) })
                  }
                  min="1"
                  max="20"
                />
                <p className="text-xs text-muted-foreground">
                  Number of times to attempt reconnection (default: 10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-backoff">Maximum backoff (seconds)</Label>
                <Input
                  id="max-backoff"
                  type="number"
                  value={settings.reconnect.maxBackoff}
                  onChange={(e) =>
                    updateReconnect({ maxBackoff: parseInt(e.target.value) })
                  }
                  min="5"
                  max="300"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum wait time between reconnect attempts (default: 60)
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Interface Tab */}
          <TabsContent value="interface" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <select
                  id="theme"
                  value={settings.interface.theme}
                  onChange={(e) => updateInterface({ theme: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-md"
                >
                  <option value="default">Default</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">Font size (pixels)</Label>
                <Input
                  id="font-size"
                  type="number"
                  value={settings.interface.fontSize}
                  onChange={(e) =>
                    updateInterface({ fontSize: parseInt(e.target.value) })
                  }
                  min="8"
                  max="24"
                />
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-timestamps"
                  checked={settings.interface.showTimestamps}
                  onCheckedChange={(checked) =>
                    updateInterface({ showTimestamps: !!checked })
                  }
                />
                <Label htmlFor="show-timestamps">Show message timestamps</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="24-hour-time"
                  checked={settings.interface.show24HourTime}
                  onCheckedChange={(checked) =>
                    updateInterface({ show24HourTime: !!checked })
                  }
                />
                <Label htmlFor="24-hour-time">Use 24-hour time format</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-userlist"
                  checked={settings.interface.showUserList}
                  onCheckedChange={(checked) =>
                    updateInterface({ showUserList: !!checked })
                  }
                />
                <Label htmlFor="show-userlist">Show user list sidebar</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-irclog"
                  checked={settings.interface.showIRCLog}
                  onCheckedChange={(checked) =>
                    updateInterface({ showIRCLog: !!checked })
                  }
                />
                <Label htmlFor="show-irclog">Show IRC protocol log</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="compact-mode"
                  checked={settings.interface.compactMode}
                  onCheckedChange={(checked) =>
                    updateInterface({ compactMode: !!checked })
                  }
                />
                <Label htmlFor="compact-mode">Use compact message layout</Label>
              </div>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clickable-urls"
                  checked={settings.chat.clickableURLs}
                  onCheckedChange={(checked) =>
                    updateChat({ clickableURLs: !!checked })
                  }
                />
                <Label htmlFor="clickable-urls">Make URLs clickable</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inline-images"
                  checked={settings.chat.inlineImages}
                  onCheckedChange={(checked) =>
                    updateChat({ inlineImages: !!checked })
                  }
                />
                <Label htmlFor="inline-images">Show inline image previews</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emoji-enabled"
                  checked={settings.chat.emojiEnabled}
                  onCheckedChange={(checked) =>
                    updateChat({ emojiEnabled: !!checked })
                  }
                />
                <Label htmlFor="emoji-enabled">Enable emoji rendering</Label>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-joinpart"
                  checked={settings.chat.showJoinPart}
                  onCheckedChange={(checked) =>
                    updateChat({ showJoinPart: !!checked })
                  }
                />
                <Label htmlFor="show-joinpart">Show JOIN/PART messages</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-quit"
                  checked={settings.chat.showQuit}
                  onCheckedChange={(checked) =>
                    updateChat({ showQuit: !!checked })
                  }
                />
                <Label htmlFor="show-quit">Show QUIT messages</Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="default-quit">Default quit message</Label>
                <Input
                  id="default-quit"
                  value={settings.chat.defaultQuitMsg}
                  onChange={(e) => updateChat({ defaultQuitMsg: e.target.value })}
                  placeholder="Goodbye"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-part">Default part message</Label>
                <Input
                  id="default-part"
                  value={settings.chat.defaultPartMsg}
                  onChange={(e) => updateChat({ defaultPartMsg: e.target.value })}
                  placeholder="Leaving"
                />
              </div>
            </div>
          </TabsContent>

          {/* Downloads Tab */}
          <TabsContent value="downloads" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="download-path">Download directory</Label>
                <Input
                  id="download-path"
                  value={settings.download.downloadPath}
                  onChange={(e) =>
                    updateDownload({ downloadPath: e.target.value })
                  }
                  placeholder="/path/to/downloads"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-concurrent">Max concurrent downloads</Label>
                <Input
                  id="max-concurrent"
                  type="number"
                  value={settings.download.maxConcurrent}
                  onChange={(e) =>
                    updateDownload({ maxConcurrent: parseInt(e.target.value) })
                  }
                  min="1"
                  max="10"
                />
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-accept"
                  checked={settings.download.autoAccept}
                  onCheckedChange={(checked) =>
                    updateDownload({ autoAccept: !!checked })
                  }
                />
                <Label htmlFor="auto-accept">Auto-accept downloads</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-retry"
                  checked={settings.download.autoRetry}
                  onCheckedChange={(checked) =>
                    updateDownload({ autoRetry: !!checked })
                  }
                />
                <Label htmlFor="auto-retry">Auto-retry failed downloads</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify-complete"
                  checked={settings.download.notifyOnComplete}
                  onCheckedChange={(checked) =>
                    updateDownload({ notifyOnComplete: !!checked })
                  }
                />
                <Label htmlFor="notify-complete">Notify when download completes</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify-fail"
                  checked={settings.download.notifyOnFail}
                  onCheckedChange={(checked) =>
                    updateDownload({ notifyOnFail: !!checked })
                  }
                />
                <Label htmlFor="notify-fail">Notify when download fails</Label>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verify-certs"
                  checked={settings.security.verifyCertificates}
                  onCheckedChange={(checked) =>
                    updateSecurity({ verifyCertificates: !!checked })
                  }
                />
                <Label htmlFor="verify-certs">Verify SSL/TLS certificates</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Most IRC servers use self-signed certificates. Enable only if your server has a valid certificate.
              </p>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow-dcc"
                  checked={settings.security.allowDCC}
                  onCheckedChange={(checked) =>
                    updateSecurity({ allowDCC: !!checked })
                  }
                />
                <Label htmlFor="allow-dcc">Allow DCC connections</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow-ctcp"
                  checked={settings.security.allowCTCP}
                  onCheckedChange={(checked) =>
                    updateSecurity({ allowCTCP: !!checked })
                  }
                />
                <Label htmlFor="allow-ctcp">Allow CTCP requests</Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="ignore-list">Ignore list (one per line)</Label>
                <textarea
                  id="ignore-list"
                  value={settings.security.ignoreList.join("\n")}
                  onChange={(e) =>
                    updateSecurity({
                      ignoreList: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter((l) => l),
                    })
                  }
                  placeholder="nickname1&#10;*!*@host.example.com"
                  className="w-full px-3 py-2 text-sm font-mono bg-background border rounded-md min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Enter nicknames or hostmasks to ignore (wildcards supported)
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
