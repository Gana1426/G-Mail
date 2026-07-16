"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/utils";
import { RefreshCw, Trash2, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QueueItem {
  id: string;
  messageId: string;
  from: string;
  to: string[];
  subject: string | null;
  direction: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export default function QueuePage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusParam =
    statusFilter !== "all" ? `&status=${statusFilter}` : "";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["queue", page, statusFilter],
    queryFn: () =>
      api.get<{ items: QueueItem[]; stats: Record<string, number> }>(
        `/queue?page=${page}&limit=20${statusParam}`
      ),
  });

  const items = (data?.data as { items?: QueueItem[] })?.items ?? [];
  const stats = (data?.data as { stats?: Record<string, number> })?.stats;

  const clearFailed = async () => {
    try {
      await api.delete("/queue?status=FAILED");
      toast({ title: "Failed queue cleared" });
      await queryClient.invalidateQueries({ queryKey: ["queue"] });
    } catch {
      toast({ title: "Clear failed", variant: "destructive" });
    }
  };

  const retry = async (id: string) => {
    try {
      await api.post("/queue", { id });
      toast({ title: "Retry queued" });
      await queryClient.invalidateQueries({ queryKey: ["queue"] });
    } catch {
      toast({ title: "Retry failed", variant: "destructive" });
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/queue?id=${id}`);
      toast({ title: "Queue item deleted" });
      await queryClient.invalidateQueries({ queryKey: ["queue"] });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const columns: ColumnDef<QueueItem>[] = [
    { accessorKey: "from", header: "From" },
    {
      accessorKey: "to",
      header: "To",
      cell: ({ row }) => row.original.to.join(", "),
    },
    { accessorKey: "subject", header: "Subject" },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.direction}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "FAILED"
              ? "destructive"
              : row.original.status === "DEFERRED"
                ? "warning"
                : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    { accessorKey: "attempts", header: "Attempts" },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {(row.original.status === "FAILED" ||
            row.original.status === "DEFERRED") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => retry(row.original.id)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItem(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout variant="admin" title="Mail Queue">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-4 text-sm">
          {stats &&
            Object.entries(stats).map(([k, v]) => (
              <div key={k} className="rounded-lg border px-3 py-2">
                <span className="text-muted-foreground">{k}: </span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
        </div>
        <div className="flex items-end gap-3">
          <div>
            <p className="mb-2 text-sm">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="DEFERRED">Deferred</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="destructive" onClick={clearFailed}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Failed
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        pagination={{
          page,
          totalPages: data?.meta?.totalPages ?? 1,
          onPageChange: setPage,
        }}
      />
    </DashboardLayout>
  );
}
