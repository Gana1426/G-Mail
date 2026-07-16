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
import {
  OrganizationFilter,
  useOrganizationFilterParam,
} from "@/components/admin/organization-filter";
import { Trash2, Power, PowerOff } from "lucide-react";

interface Forwarder {
  id: string;
  sourceEmail: string;
  targetEmail: string | null;
  type: string;
  isActive: boolean;
  domain: { name: string };
}

export default function ForwardersPage() {
  const [page, setPage] = useState(1);
  const [orgFilter, setOrgFilter] = useState("all");
  const orgParam = useOrganizationFilterParam(orgFilter);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["forwarders", page, orgFilter],
    queryFn: () =>
      api.get<Forwarder[]>(`/forwarders?page=${page}&limit=20${orgParam}`),
  });

  const toggleActive = async (fwd: Forwarder) => {
    try {
      await api.patch(`/forwarders/${fwd.id}`, { isActive: !fwd.isActive });
      toast({ title: fwd.isActive ? "Forwarder disabled" : "Forwarder enabled" });
      await queryClient.invalidateQueries({ queryKey: ["forwarders"] });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const deleteForwarder = async (id: string) => {
    try {
      await api.delete(`/forwarders/${id}`);
      toast({ title: "Forwarder deleted" });
      await queryClient.invalidateQueries({ queryKey: ["forwarders"] });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const columns: ColumnDef<Forwarder>[] = [
    { accessorKey: "sourceEmail", header: "Source" },
    {
      accessorKey: "targetEmail",
      header: "Destination",
      cell: ({ row }) => row.original.targetEmail ?? "—",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.type}</Badge>
      ),
    },
    {
      accessorKey: "domain",
      header: "Domain",
      cell: ({ row }) => row.original.domain.name,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleActive(row.original)}
          >
            {row.original.isActive ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteForwarder(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout variant="admin" title="Forwarders">
      <div className="mb-6">
        <OrganizationFilter value={orgFilter} onChange={setOrgFilter} />
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
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
