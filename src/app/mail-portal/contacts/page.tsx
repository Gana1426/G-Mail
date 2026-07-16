"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailLayout } from "@mail-portal/components/layout/mail-layout";
import { mailApi } from "@mail-portal/services/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, UserPlus } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
}

export default function MailContactsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["mail-contacts"],
    queryFn: async () => {
      const res = await mailApi.get<{ contacts: Contact[]; groups: unknown[] }>(
        "/contacts"
      );
      return res.data!;
    },
  });

  const createContact = async () => {
    try {
      await mailApi.post("/contacts", form);
      toast({ title: "Contact added" });
      setForm({ name: "", email: "", phone: "", company: "" });
      await queryClient.invalidateQueries({ queryKey: ["mail-contacts"] });
    } catch (error) {
      toast({
        title: "Failed to add contact",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    }
  };

  const exportCsv = () => {
    const contacts = data?.contacts ?? [];
    const rows = [
      ["Name", "Email", "Phone", "Company"],
      ...contacts.map((c) => [c.name, c.email, c.phone ?? "", c.company ?? ""]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").slice(1);
    const contacts = lines
      .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "").trim()))
      .filter((parts) => parts[1])
      .map((parts) => ({ name: parts[0], email: parts[1] }));

    try {
      await mailApi.post("/contacts", { action: "import", contacts });
      toast({ title: `${contacts.length} contacts imported` });
      await queryClient.invalidateQueries({ queryKey: ["mail-contacts"] });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    }
  };

  return (
    <MailLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4" /> Add contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <Button onClick={createContact}>Save contact</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Personal contacts ({data?.contacts.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (data?.contacts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts yet</p>
              ) : (
                data?.contacts.map((contact) => (
                  <div key={contact.id} className="rounded-lg border p-3">
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MailLayout>
  );
}
