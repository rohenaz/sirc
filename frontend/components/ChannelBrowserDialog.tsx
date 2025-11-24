"use client";

import { useEffect, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Channel {
  name: string;
  topic: string;
  users: number;
  joined: boolean;
}

interface ChannelBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
  onChannelSelected: (channelName: string) => void;
}

export function ChannelBrowserDialog({
  open,
  onOpenChange,
  serverId,
  serverName,
  onChannelSelected,
}: ChannelBrowserDialogProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "users", desc: true }, // Default sort by users descending
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [ListChannels, setListChannels] = useState<any>(null);
  const [GetChannelList, setGetChannelList] = useState<any>(null);
  const [IsChannelListInProgress, setIsChannelListInProgress] = useState<any>(null);

  // Define columns with sorting
  const columns: ColumnDef<Channel>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            type="button"
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Channel
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-mono font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "users",
      header: ({ column }) => {
        return (
          <Button
            type="button"
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Users
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <Badge variant="secondary">{row.getValue("users")}</Badge>
      ),
    },
    {
      accessorKey: "topic",
      header: "Topic",
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm truncate max-w-[500px]">
          {row.getValue("topic") || <span className="italic">No topic</span>}
        </div>
      ),
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: channels,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  // Dynamically import Wails bindings (client-side only)
  useEffect(() => {
    import("@/bindings/sirc/pkg/services/ircservice").then((module) => {
      setListChannels(() => module.ListChannels);
      setGetChannelList(() => module.GetChannelList);
      setIsChannelListInProgress(() => module.IsChannelListInProgress);
    });
  }, []);

  // Fetch channel list when dialog opens
  useEffect(() => {
    if (open && serverId && ListChannels && GetChannelList && IsChannelListInProgress) {
      fetchChannelList();
    }
  }, [open, serverId, ListChannels, GetChannelList, IsChannelListInProgress]);

  const fetchChannelList = async () => {
    if (!ListChannels || !GetChannelList || !IsChannelListInProgress) return;

    setLoading(true);
    try {
      // Request channel list from server
      await ListChannels(serverId);

      // Poll and stream channels as they arrive (max 30 seconds)
      let attempts = 0;
      const maxAttempts = 300; // 30 seconds at 100ms intervals
      let pollInterval: NodeJS.Timeout | null = null;

      const stopPolling = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        setLoading(false);
      };

      pollInterval = setInterval(async () => {
        attempts++;

        try {
          // Fetch current channel list and update UI
          const channelList = await GetChannelList(serverId);
          console.log(`[ChannelBrowser] Poll attempt ${attempts}: Got ${channelList?.length || 0} channels`);
          setChannels(channelList);

          // Check if loading is complete
          const inProgress = await IsChannelListInProgress(serverId);
          console.log(`[ChannelBrowser] Poll attempt ${attempts}: inProgress=${inProgress}`);

          // Stop polling when list is complete OR max attempts exceeded
          if (!inProgress || attempts >= maxAttempts) {
            console.log(`[ChannelBrowser] Polling complete. Stopping. inProgress=${inProgress}, attempts=${attempts}`);
            stopPolling();
          }
        } catch (error) {
          console.error("Failed to fetch channel list:", error);
          stopPolling();
        }
      }, 100);
    } catch (error) {
      console.error("Failed to request channel list:", error);
      setLoading(false);
    }
  };

  const handleChannelClick = (channelName: string) => {
    console.log(`[ChannelBrowser] Channel clicked: ${channelName}`);
    try {
      // Notify parent - it will handle the join
      onChannelSelected(channelName);
      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error(`[ChannelBrowser] Error selecting channel:`, error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Browse Channels - {serverName}</DialogTitle>
          <DialogDescription>
            Select a channel to join. Click refresh to update the list.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search channels..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(e) =>
                table.getColumn("name")?.setFilterValue(e.target.value)
              }
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={fetchChannelList}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 h-[500px]">
          {loading && channels.length === 0 ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))}
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {channels.length === 0
                ? "No channels found. Click Refresh to load channels."
                : "No channels match your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleChannelClick(row.original.name)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <div className="px-6 py-4 border-t text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {channels.length} channels
        </div>
      </DialogContent>
    </Dialog>
  );
}
