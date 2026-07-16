"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api.client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface OrganizationOption {
  id: string;
  name: string;
}

interface OrganizationFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OrganizationFilter({
  value,
  onChange,
  className,
}: OrganizationFilterProps) {
  const { data } = useQuery({
    queryKey: ["organizations-filter"],
    queryFn: async () => {
      const res = await api.get<OrganizationOption[]>(
        "/organizations?limit=100"
      );
      return res.data ?? [];
    },
  });

  return (
    <div className={className}>
      <Label className="mb-2 block text-sm">Organization</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All Organizations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Organizations</SelectItem>
          {data?.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function useOrganizationFilterParam(orgId: string): string {
  return orgId && orgId !== "all" ? `&organizationId=${orgId}` : "";
}
