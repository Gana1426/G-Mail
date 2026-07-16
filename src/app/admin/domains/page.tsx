"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api.client";
import { formatDateTime } from "@/utils";
import {
  OrganizationFilter,
  useOrganizationFilterParam,
} from "@/components/admin/organization-filter";

interface Domain {
  id: string;
  name: string;
  status: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  mxStatus: string;
  organization: { id: string; name: string };
  _count: { mailboxes: number };
  createdAt: string;
}

const dnsStatusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  VALID: "success",
  PENDING: "warning",
  INVALID: "destructive",
  MISSING: "secondary",
};

const columns: ColumnDef<Domain>[] = [
  {
    accessorKey: "name",
    header: "Domain",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.organization.name}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={dnsStatusVariant[row.original.status] ?? "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "spf",
    header: "SPF",
    cell: ({ row }) => (
      <Badge variant={dnsStatusVariant[row.original.spfStatus] ?? "secondary"}>
        {row.original.spfStatus}
      </Badge>
    ),
  },
  {
    accessorKey: "mailboxes",
    header: "Mailboxes",
    cell: ({ row }) => row.original._count.mailboxes,
  },
  {
    accessorKey: "createdAt",
    header: "Added",
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

function DomainsContent() {
  const searchParams = useSearchParams();
  const initialOrg = searchParams.get("organizationId") ?? "all";
  const [page, setPage] = useState(1);
  const [orgFilter, setOrgFilter] = useState(initialOrg);
  const orgParam = useOrganizationFilterParam(orgFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["domains", page, orgFilter],
    queryFn: () =>
      api.get<Domain[]>(`/domains?page=${page}&limit=20${orgParam}`),
  });

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
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
    </>
  );
}

export default function DomainsPage() {
  return (
    <DashboardLayout variant="admin" title="Domains">
      <Suspense fallback={<div>Loading...</div>}>
        <DomainsContent />
      </Suspense>
    </DashboardLayout>
  );
}
