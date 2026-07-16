"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mailApi } from "@mail-portal/services/api.client";
import { RichTextEditor } from "@mail-portal/components/mail/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MailSettings } from "@mail-portal/types/mail";
import {
  Loader2,
  Plus,
  Trash2,
  Eye,
  Pencil,
  ImageIcon,
  Table2,
  Copy,
  Star,
  Share2,
  Link2,
  LifeBuoy,
  Megaphone,
} from "lucide-react";

const SOCIAL_ICONS = [
  { label: "LinkedIn", href: "https://linkedin.com/in/you", text: "LinkedIn" },
  { label: "Twitter", href: "https://twitter.com/you", text: "Twitter" },
  { label: "GitHub", href: "https://github.com/you", text: "GitHub" },
  { label: "Facebook", href: "https://facebook.com/you", text: "Facebook" },
  { label: "Instagram", href: "https://instagram.com/you", text: "Instagram" },
];

const SIGNATURE_TEMPLATES = {
  business: `<table cellpadding="0" cellspacing="0" style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#333;max-width:560px;">
  <tr>
    <td style="padding-right:20px;vertical-align:top;border-right:1px solid #e5e5e5;">
      <p style="margin:0 0 8px;color:#333;">Regards,</p>
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#4a9fd4;">Your Name</p>
      <p style="margin:0 0 12px;font-weight:700;color:#111;">Software Engineer</p>
      <img src="https://via.placeholder.com/120x48?text=Logo" alt="Company logo" width="120" style="max-width:120px;height:auto;display:block;" data-signature-logo="true" />
    </td>
    <td style="padding-left:20px;vertical-align:top;line-height:1.6;">
      <p style="margin:0 0 6px;"><strong style="color:#4a9fd4;">E</strong> <span style="color:#888;">you@company.com</span></p>
      <p style="margin:0 0 6px;"><strong style="color:#4a9fd4;">M</strong> <span style="color:#4a9fd4;">+1 (555) 000-0000</span></p>
      <p style="margin:0;"><strong style="color:#4a9fd4;">A</strong> Your company address line, City - PIN</p>
    </td>
  </tr>
</table>`,
  social: `<p><strong>Your Name</strong></p>
<p>
  <a href="https://linkedin.com">LinkedIn</a> ·
  <a href="https://twitter.com">Twitter</a> ·
  <a href="https://github.com">GitHub</a>
</p>`,
  support: `<p>Best regards,<br/><strong>Support Team</strong></p>
<p style="color:#666;font-size:12px;">Need help? Reply to this email or visit our help center.</p>`,
  marketing: `<p style="color:#0f6cbd;"><strong>Your Brand</strong></p>
<p>Thanks for connecting with us!</p>
<p><a href="https://example.com">Visit our website</a></p>`,
};

interface SignatureManagerProps {
  settings: MailSettings;
  onSaved?: () => void;
}

export function SignatureManager({ settings, onSaved }: SignatureManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    settings.signatures[0]?.id ?? null
  );
  const [name, setName] = useState(settings.signatures[0]?.name ?? "Personal");
  const [content, setContent] = useState(settings.signatures[0]?.content ?? "");
  const [preview, setPreview] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.signatures.length === 0) {
      if (!editingId) return;
      setEditingId(null);
      setName("New signature");
      setContent("");
      setPreview(false);
      return;
    }

    if (!editingId) return;

    const current = settings.signatures.find((signature) => signature.id === editingId);
    if (!current) {
      const fallback = settings.signatures[0];
      if (!fallback) return;
      setEditingId(fallback.id);
      setName(fallback.name);
      setContent(fallback.content);
      setPreview(false);
      return;
    }

    setName(current.name);
    setContent(current.content);
  }, [settings.signatures, editingId]);

  const startNew = () => {
    setEditingId(null);
    setName("New signature");
    setContent("");
    setPreview(false);
  };

  const loadSignature = (id: string) => {
    const sig = settings.signatures.find((s) => s.id === id);
    if (!sig) return;
    setEditingId(sig.id);
    setName(sig.name);
    setContent(sig.content);
    setPreview(false);
  };

  const saveSignature = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const current = editingId
        ? settings.signatures.find((signature) => signature.id === editingId)
        : null;
      await mailApi.post("/settings", {
        action: "signature",
        id: editingId ?? undefined,
        name: name.trim(),
        content,
        isDefault: current?.isDefault ?? settings.signatures.length === 0,
      });
      toast({ title: "Signature saved" });
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
      onSaved?.();
    } catch (error) {
      toast({
        title: "Failed to save signature",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSignature = async (id: string) => {
    setSaving(true);
    try {
      await mailApi.post("/settings", { action: "deleteSignature", id });
      toast({ title: "Signature deleted" });
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
      if (editingId === id) startNew();
      onSaved?.();
    } catch (error) {
      toast({
        title: "Failed to delete signature",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const insertTemplate = (template: keyof typeof SIGNATURE_TEMPLATES) => {
    setContent((prev) => `${prev}${SIGNATURE_TEMPLATES[template]}`);
    setPreview(false);
  };

  const insertLogoPlaceholder = () => {
    logoInputRef.current?.click();
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setContent((prev) => {
        if (prev.includes('data-signature-logo="true"')) {
          return prev.replace(
            /<img[^>]*data-signature-logo="true"[^>]*>/i,
            `<img src="${src}" alt="Company logo" width="120" style="max-width:120px;height:auto;display:block;" data-signature-logo="true" />`
          );
        }
        return `${prev}<p><img src="${src}" alt="Logo" width="120" style="max-width:120px;height:auto;" data-signature-logo="true" /></p>`;
      });
      setPreview(false);
    };
    reader.readAsDataURL(file);
  };

  const insertSocialIcons = () => {
    const links = SOCIAL_ICONS.map(
      (s) => `<a href="${s.href}" style="margin-right:8px;">${s.text}</a>`
    ).join("");
    setContent((prev) => `${prev}<p>${links}</p>`);
    setPreview(false);
  };

  const duplicateSignature = async (id: string) => {
    setSaving(true);
    try {
      await mailApi.post("/settings", { action: "duplicateSignature", id });
      toast({ title: "Signature duplicated" });
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
      onSaved?.();
    } catch (error) {
      toast({
        title: "Failed to duplicate signature",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (id: string) => {
    setSaving(true);
    try {
      await mailApi.post("/settings", { action: "setDefaultSignature", id });
      toast({ title: "Default signature updated" });
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
      onSaved?.();
    } catch (error) {
      toast({
        title: "Failed to set default",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveDefaults = async (patch: Partial<MailSettings>) => {
    setSaving(true);
    try {
      await mailApi.patch("/settings", patch);
      toast({ title: "Signature defaults updated" });
      await queryClient.invalidateQueries({ queryKey: ["mail-settings"] });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Signatures</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={startNew}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add signature</TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
              e.target.value = "";
            }}
          />
          {settings.signatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.signatures.map((sig) => (
                <Button
                  key={sig.id}
                  size="sm"
                  variant={editingId === sig.id ? "default" : "outline"}
                  onClick={() => loadSignature(sig.id)}
                >
                  {sig.name}
                  {sig.isDefault && " (default)"}
                </Button>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label>Signature name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-end justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreview((p) => !p)}
                  >
                    {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{preview ? "Edit" : "Preview"}</TooltipContent>
              </Tooltip>
              {editingId && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAsDefault(editingId)}
                        disabled={saving}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Set default</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => duplicateSignature(editingId)}
                        disabled={saving}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteSignature(editingId)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={insertLogoPlaceholder}>
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload logo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={insertSocialIcons}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Social icons</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => insertTemplate("business")}>
                  <Table2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Business template</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => insertTemplate("social")}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Social links</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => insertTemplate("support")}>
                  <LifeBuoy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Support template</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => insertTemplate("marketing")}>
                  <Megaphone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marketing template</TooltipContent>
            </Tooltip>
          </div>

          {preview ? (
            <div
              className="min-h-[160px] rounded-md border bg-muted/20 p-4 prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: content || "<p><em>Empty signature</em></p>" }}
            />
          ) : (
            <RichTextEditor
              value={content}
              onChange={setContent}
              autoFocus={false}
              scrollable={false}
            />
          )}

          <Button onClick={saveSignature} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save signature
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default signatures</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {(
            [
              ["signatureForNew", "New email"],
              ["signatureForReply", "Reply"],
              ["signatureForForward", "Forward"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Select
                value={settings[key] ?? "none"}
                onValueChange={(v) =>
                  saveDefaults({ [key]: v === "none" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {settings.signatures.map((sig) => (
                    <SelectItem key={sig.id} value={sig.id}>
                      {sig.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
