"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerAdded?: (serverId: string) => void;
}

interface ServerTemplate {
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  description: string;
}

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  nick: string;
  user: string;
  realName: string;
  password?: string;
}

export function AddServerDialog({
  open,
  onOpenChange,
  onServerAdded,
}: AddServerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ServerTemplate[]>([]);
  const [existingServers, setExistingServers] = useState<Server[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("new");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "6667",
    nick: "",
    user: "",
    realName: "",
    password: "",
    ssl: false,
  });

  // Dynamically import bindings
  const [AddServer, setAddServer] = useState<any>(null);
  const [Connect, setConnect] = useState<any>(null);
  const [GetServerTemplates, setGetServerTemplates] = useState<any>(null);
  const [GetServers, setGetServers] = useState<any>(null);

  useEffect(() => {
    import("@/bindings/sirc/pkg/services/ircservice").then((module) => {
      setAddServer(() => module.AddServer);
      setConnect(() => module.Connect);
      setGetServerTemplates(() => module.GetServerTemplates);
      setGetServers(() => module.GetServers);
    });
  }, []);

  // Load templates and existing servers when dialog opens
  useEffect(() => {
    if (open && GetServerTemplates && GetServers) {
      loadTemplatesAndServers();
    }
  }, [open, GetServerTemplates, GetServers]);

  const loadTemplatesAndServers = async () => {
    try {
      const [temps, servers] = await Promise.all([
        GetServerTemplates(),
        GetServers(),
      ]);
      setTemplates(temps || []);
      setExistingServers(servers || []);
    } catch (error) {
      console.error("Failed to load templates and servers:", error);
    }
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    setEditingServerId(null);

    if (value === "new") {
      // Reset to blank form
      setFormData({
        name: "",
        host: "",
        port: "6667",
        nick: "",
        user: "",
        realName: "",
        password: "",
        ssl: false,
      });
    } else if (value.startsWith("template:")) {
      // Load template
      const templateName = value.substring(9);
      const template = templates.find((t) => t.name === templateName);
      if (template) {
        setFormData({
          name: template.name,
          host: template.host,
          port: template.port.toString(),
          nick: "",
          user: "",
          realName: "",
          password: "",
          ssl: template.ssl,
        });
      }
    } else if (value.startsWith("server:")) {
      // Load existing server for editing
      const serverId = value.substring(7);
      const server = existingServers.find((s) => s.id === serverId);
      if (server) {
        setEditingServerId(server.id);
        setFormData({
          name: server.name,
          host: server.host,
          port: server.port.toString(),
          nick: server.nick,
          user: server.user,
          realName: server.realName,
          password: server.password || "",
          ssl: server.ssl,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!AddServer || !Connect) {
      alert("IRC service not ready. Please try again.");
      return;
    }

    setLoading(true);

    try {
      // Use existing ID if editing, otherwise create new ID
      const serverId = editingServerId || formData.name.toLowerCase().replace(/\s+/g, "-");

      // Dynamically import Server class
      const { Server } = await import("@/bindings/sirc/pkg/irc/models");

      const server = new Server({
        id: serverId,
        name: formData.name,
        host: formData.host,
        port: Number.parseInt(formData.port),
        ssl: formData.ssl,
        nick: formData.nick,
        user: formData.user || formData.nick,
        realName: formData.realName || formData.nick,
        password: formData.password || undefined,
      });

      // Add server to backend
      await AddServer(server);

      // Connect to server
      await Connect(serverId);

      // Reset form and close dialog
      setFormData({
        name: "",
        host: "",
        port: "6667",
        nick: "",
        user: "",
        realName: "",
        password: "",
        ssl: false,
      });
      setSelectedPreset("new");
      setEditingServerId(null);
      onOpenChange(false);
      onServerAdded?.(serverId);
    } catch (error) {
      console.error("Failed to add server:", error);
      alert(`Failed to add server: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingServerId ? "Edit IRC Server" : "Add IRC Server"}
          </DialogTitle>
          <DialogDescription>
            {editingServerId
              ? "Update server settings and reconnect."
              : "Choose a preset or enter custom server details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Server Preset Selector */}
            <div className="grid gap-2">
              <Label htmlFor="preset">Server Preset</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a server preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="new">New Server</SelectItem>
                  </SelectGroup>

                  {templates.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Templates</SelectLabel>
                        {templates.map((template) => (
                          <SelectItem
                            key={template.name}
                            value={`template:${template.name}`}
                          >
                            {template.name} - {template.description}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}

                  {existingServers.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Existing Servers</SelectLabel>
                        {existingServers.map((server) => (
                          <SelectItem
                            key={server.id}
                            value={`server:${server.id}`}
                          >
                            {server.name} ({server.host})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Server Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                placeholder="Rizon"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* Host and Port */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  placeholder="irc.rizon.net"
                  value={formData.host}
                  onChange={(e) =>
                    setFormData({ ...formData, host: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="6667"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Nickname */}
            <div className="grid gap-2">
              <Label htmlFor="nick">Nickname</Label>
              <Input
                id="nick"
                placeholder="MyNick"
                value={formData.nick}
                onChange={(e) =>
                  setFormData({ ...formData, nick: e.target.value })
                }
                required
              />
            </div>

            {/* Username and Real Name */}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="user">Username (optional)</Label>
                <Input
                  id="user"
                  placeholder={formData.nick || "username"}
                  value={formData.user}
                  onChange={(e) =>
                    setFormData({ ...formData, user: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="realName">Real Name (optional)</Label>
                <Input
                  id="realName"
                  placeholder={formData.nick || "Real Name"}
                  value={formData.realName}
                  onChange={(e) =>
                    setFormData({ ...formData, realName: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave empty if not required"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            {/* SSL/TLS Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ssl"
                checked={formData.ssl}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ssl: e.target.checked,
                    port: e.target.checked ? "6697" : "6667",
                  })
                }
                className="h-4 w-4 rounded border bg-background"
              />
              <Label htmlFor="ssl" className="cursor-pointer">
                Use SSL/TLS
              </Label>
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
              {loading
                ? "Connecting..."
                : editingServerId
                  ? "Update & Reconnect"
                  : "Add & Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
