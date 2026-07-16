"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api.client";
import { formatBytes, formatDateTime } from "@/utils";
import {
  OrganizationFilter,
  useOrganizationFilterParam,
} from "@/components/admin/organization-filter";

interface Mailbox {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  quotaBytes: string;
  usedBytes: string;
  domain: { name: string };
  organization: { name: string };
  createdAt: string;
}

const columns: ColumnDef<Mailbox>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.email}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.organization.name}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "domain",
    header: "Domain",
    cell: ({ row }) => row.original.domain.name,
  },
  {
    id: "storage",
    header: "Storage",
    cell: ({ row }) =>
      `${formatBytes(BigInt(row.original.usedBytes))} / ${formatBytes(BigInt(row.original.quotaBytes))}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.status === "ACTIVE" ? "success" : "destructive"
        }
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

function MailboxesContent() {
  const searchParams = useSearchParams();
  const initialOrg = searchParams.get("organizationId") ?? "all";
  const [page, setPage] = useState(1);
  const [orgFilter, setOrgFilter] = useState(initialOrg);
  const orgParam = useOrganizationFilterParam(orgFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["mailboxes", page, orgFilter],
    queryFn: () =>
      api.get<Mailbox[]>(`/mailboxes?page=${page}&limit=20${orgParam}`),
  });

  return (
    <>
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
    </>
  );
}

export default function MailboxesPage() {
  return (
    <DashboardLayout variant="admin" title="Mailboxes">
      <Suspense fallback={<div>Loading...</div>}>
        <MailboxesContent />
      </Suspense>
    </DashboardLayout>
  );
}
