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
import {
  OrganizationFilter,
  useOrganizationFilterParam,
} from "@/components/admin/organization-filter";
import { Trash2, Unlock } from "lucide-react";

interface SpamLog {
  id: string;
  from: string;
  to: string;
  subject: string | null;
  score: number;
  action: string;
  isQuarantined: boolean;
  createdAt: string;
}

export default function SpamPage() {
  const [page, setPage] = useState(1);
  const [orgFilter, setOrgFilter] = useState("all");
  const orgParam = useOrganizationFilterParam(orgFilter);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["spam", page, orgFilter],
    queryFn: () =>
      api.get<{ logs: SpamLog[] }>(`/spam?page=${page}&limit=20${orgParam}`),
  });

  const logs = (data?.data as { logs?: SpamLog[] })?.logs ?? [];

  const release = async (id: string) => {
    try {
      await api.post("/spam", { action: "release", id });
      toast({ title: "Message released" });
      await queryClient.invalidateQueries({ queryKey: ["spam"] });
    } catch {
      toast({ title: "Release failed", variant: "destructive" });
    }
  };

  const deleteMail = async (id: string) => {
    try {
      await api.post("/spam", { action: "delete", id });
      toast({ title: "Message deleted" });
      await queryClient.invalidateQueries({ queryKey: ["spam"] });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const columns: ColumnDef<SpamLog>[] = [
    { accessorKey: "from", header: "From" },
    { accessorKey: "to", header: "To" },
    { accessorKey: "subject", header: "Subject" },
    { accessorKey: "score", header: "Score" },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
    },
    {
      accessorKey: "isQuarantined",
      header: "Quarantined",
      cell: ({ row }) => (
        <Badge variant={row.original.isQuarantined ? "warning" : "secondary"}>
          {row.original.isQuarantined ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.isQuarantined && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => release(row.original.id)}
            >
              <Unlock className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMail(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout variant="admin" title="Spam Queue">
      <div className="mb-6">
        <OrganizationFilter value={orgFilter} onChange={setOrgFilter} />
      </div>
      <DataTable
        columns={columns}
        data={logs}
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
