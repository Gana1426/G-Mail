"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Link2,
  Link2Off,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  ImageIcon,
  Smile,
  Quote,
  Code,
  Minus,
  Table2,
  AtSign,
  Eraser,
  Maximize2,
  Minimize2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils";

const EMOJI_OPTIONS = [
  "😀", "😊", "👍", "🎉", "❤️", "🔥", "✅", "📎",
  "📧", "🙏", "😅", "🚀", "⭐", "💡", "📅", "☕",
];

const FONT_FAMILIES = [
  { label: "Segoe UI", value: "Segoe UI, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
];

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Huge", value: "5" },
];

const MENTION_SUGGESTIONS = ["team", "support", "everyone"];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  mode?: "html" | "plain";
  onModeChange?: (mode: "html" | "plain") => void;
  autoFocus?: boolean;
  onInsertImage?: () => void;
  /** When false, editor grows with content and page scroll handles overflow */
  scrollable?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your message...",
  className,
  mode = "html",
  onModeChange,
  autoFocus = true,
  onInsertImage,
  scrollable = true,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageActionRef = useRef<"insert" | "replace">("insert");
  const resizeOriginRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const skipNextSync = useRef(false);
  const mounted = useRef(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageWidth, setImageWidth] = useState(320);
  const [imageBox, setImageBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isResizingImage, setIsResizingImage] = useState(false);

  useEffect(() => {
    if (mode !== "html" || !editorRef.current) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const el = editorRef.current;
    const next = value || "";
    if (!mounted.current || el.innerHTML !== next) {
      el.innerHTML = next;
      mounted.current = true;
    }
  }, [value, mode]);

  useEffect(() => {
    if (!autoFocus) return;
    if (mode === "html") editorRef.current?.focus();
    else textareaRef.current?.focus();
  }, [autoFocus, mode]);

  const syncChange = useCallback(() => {
    if (!editorRef.current) return;
    skipNextSync.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const exec = useCallback(
    (command: string, val?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, val);
      syncChange();
    },
    [syncChange]
  );

  const insertHtml = useCallback(
    (html: string) => {
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, html);
      syncChange();
    },
    [syncChange]
  );

  const handleInput = () => syncChange();

  const addLink = () => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
  };

  const insertImageFromFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (imageActionRef.current === "replace" && selectedImage) {
        selectedImage.setAttribute("src", src);
        selectedImage.style.maxWidth = "100%";
        selectedImage.style.height = selectedImage.style.height || "auto";
        syncChange();
        return;
      }
      insertHtml(`<img src="${src}" alt="Image" style="max-width:100%;height:auto;" />`);
    };
    reader.readAsDataURL(file);
  };

  const handleImagePick = () => {
    imageActionRef.current = "insert";
    if (onInsertImage) {
      onInsertImage();
      return;
    }
    fileInputRef.current?.click();
  };

  const insertEmoji = (emoji: string) => {
    exec("insertText", emoji);
    setEmojiOpen(false);
  };

  const insertMention = (name: string) => {
    insertHtml(
      `<span style="background:#e8f3fc;color:#0f6cbd;padding:0 4px;border-radius:4px;">@${name}</span>&nbsp;`
    );
    setMentionOpen(false);
  };

  const insertTable = () => {
    insertHtml(
      `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      </table><p><br/></p>`
    );
  };

  const insertChecklist = () => {
    insertHtml(
      `<ul style="list-style:none;padding-left:0;">
        <li>☐ Item 1</li>
        <li>☐ Item 2</li>
      </ul>`
    );
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) insertImageFromFile(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/")
    );
    if (file) insertImageFromFile(file);
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const image = target as HTMLImageElement;
      setSelectedImage(image);
      setImageWidth(image.getBoundingClientRect().width || parseInt(image.getAttribute("width") || "320", 10) || 320);
    } else {
      setSelectedImage(null);
      setImageBox(null);
    }
  };

  const applyImageWidth = () => {
    if (!selectedImage) return;
    selectedImage.setAttribute("width", String(imageWidth));
    selectedImage.style.width = `${imageWidth}px`;
    selectedImage.style.height = "auto";
    syncChange();
  };

  const refreshImageBox = useCallback(() => {
    if (!selectedImage || !editorRef.current) {
      setImageBox(null);
      return;
    }
    const imageRect = selectedImage.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    setImageBox({
      top: imageRect.top - editorRect.top + editorRef.current.scrollTop,
      left: imageRect.left - editorRect.left + editorRef.current.scrollLeft,
      width: imageRect.width,
      height: imageRect.height,
    });
  }, [selectedImage]);

  const applyImageAlignment = (align: "left" | "center" | "right") => {
    if (!selectedImage) return;
    selectedImage.style.display = "block";
    selectedImage.style.marginTop = "0";
    selectedImage.style.marginBottom = "0";
    if (align === "left") {
      selectedImage.style.marginLeft = "0";
      selectedImage.style.marginRight = "auto";
    } else if (align === "center") {
      selectedImage.style.marginLeft = "auto";
      selectedImage.style.marginRight = "auto";
    } else {
      selectedImage.style.marginLeft = "auto";
      selectedImage.style.marginRight = "0";
    }
    syncChange();
    refreshImageBox();
  };

  const removeSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    setImageBox(null);
    syncChange();
  };

  const replaceSelectedImage = () => {
    if (!selectedImage) return;
    imageActionRef.current = "replace";
    fileInputRef.current?.click();
  };

  useEffect(() => {
    refreshImageBox();
  }, [selectedImage, imageWidth, refreshImageBox]);

  useEffect(() => {
    if (!selectedImage) return;
    const update = () => refreshImageBox();
    window.addEventListener("resize", update);
    editorRef.current?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      editorRef.current?.removeEventListener("scroll", update);
    };
  }, [selectedImage, refreshImageBox]);

  useEffect(() => {
    if (!selectedImage || !isResizingImage) return;
    const origin = resizeOriginRef.current;
    if (!origin) return;
    const aspectRatio = origin.startWidth / Math.max(origin.startHeight, 1);

    const handlePointerMove = (event: MouseEvent) => {
      const deltaX = event.clientX - origin.startX;
      const deltaY = event.clientY - origin.startY;
      const nextWidth = Math.max(80, Math.round(origin.startWidth + deltaX));
      const nextHeight = event.shiftKey
        ? Math.max(40, Math.round(origin.startHeight + deltaY))
        : Math.max(40, Math.round(nextWidth / aspectRatio));
      selectedImage.style.width = `${nextWidth}px`;
      selectedImage.style.height = `${nextHeight}px`;
      selectedImage.setAttribute("width", String(nextWidth));
      if (!event.shiftKey) {
        selectedImage.removeAttribute("height");
      }
      setImageWidth(nextWidth);
      refreshImageBox();
    };

    const handlePointerUp = () => {
      setIsResizingImage(false);
      resizeOriginRef.current = null;
      syncChange();
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isResizingImage, refreshImageBox, selectedImage, syncChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode !== "html" || !editorRef.current?.contains(document.activeElement)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const map: Record<string, string> = {
        b: "bold",
        i: "italic",
        u: "underline",
        z: "undo",
        y: "redo",
      };
      const cmd = map[e.key.toLowerCase()];
      if (cmd) {
        e.preventDefault();
        exec(cmd);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, exec]);

  const toolbarButtons = [
    { icon: Undo2, cmd: "undo", label: "Undo (Ctrl+Z)" },
    { icon: Redo2, cmd: "redo", label: "Redo (Ctrl+Y)" },
    { icon: Bold, cmd: "bold", label: "Bold (Ctrl+B)" },
    { icon: Italic, cmd: "italic", label: "Italic (Ctrl+I)" },
    { icon: Underline, cmd: "underline", label: "Underline (Ctrl+U)" },
    { icon: Strikethrough, cmd: "strikeThrough", label: "Strikethrough" },
    { icon: List, cmd: "insertUnorderedList", label: "Bullet list" },
    { icon: ListOrdered, cmd: "insertOrderedList", label: "Numbered list" },
    { icon: AlignLeft, cmd: "justifyLeft", label: "Align left" },
    { icon: AlignCenter, cmd: "justifyCenter", label: "Align center" },
    { icon: AlignRight, cmd: "justifyRight", label: "Align right" },
    { icon: AlignJustify, cmd: "justifyFull", label: "Justify" },
  ];

  const editorBody =
    mode === "plain" ? (
      <textarea
        ref={textareaRef}
        value={value.replace(/<[^>]*>/g, "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[240px] w-full resize-y p-4 text-sm outline-none"
      />
    ) : (
      <div className="relative">
        {selectedImage && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-2 py-1.5 text-xs">
            <span>Image:</span>
            <Input
              type="number"
              className="h-7 w-20"
              value={imageWidth}
              min={80}
              max={800}
              onChange={(e) => setImageWidth(Number(e.target.value))}
            />
            <Button type="button" size="sm" className="h-7" onClick={applyImageWidth}>
              Apply
            </Button>
            <input
              type="range"
              min={80}
              max={800}
              value={imageWidth}
              onChange={(e) => setImageWidth(Number(e.target.value))}
            />
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => applyImageAlignment("left")}>
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => applyImageAlignment("center")}>
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => applyImageAlignment("right")}>
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7"
              title="Replace image"
              onClick={replaceSelectedImage}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Remove image"
              onClick={removeSelectedImage}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline
          className={cn(
            "min-h-[240px] p-4 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            scrollable ? "max-h-[50vh] overflow-y-auto" : "overflow-visible"
          )}
          data-placeholder={placeholder}
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleEditorClick}
          suppressContentEditableWarning
        />
        {selectedImage && imageBox && (
          <>
            <div
              className="pointer-events-none absolute rounded border border-primary/60 shadow-[0_0_0_1px_rgba(15,108,189,0.15)]"
              style={{
                top: imageBox.top,
                left: imageBox.left,
                width: imageBox.width,
                height: imageBox.height,
              }}
            />
            <button
              type="button"
              className="absolute h-3 w-3 rounded-full border border-primary bg-background shadow"
              style={{
                top: imageBox.top + imageBox.height - 6,
                left: imageBox.left + imageBox.width - 6,
                cursor: "nwse-resize",
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resizeOriginRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  startWidth: selectedImage.getBoundingClientRect().width,
                  startHeight: selectedImage.getBoundingClientRect().height,
                };
                setIsResizingImage(true);
              }}
            />
          </>
        )}
      </div>
    );

  const shell = (
    <div className={cn("rounded-lg border bg-background", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImageFromFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        {mode === "html" &&
          toolbarButtons.map(({ icon: Icon, cmd, label }) => (
            <Button
              key={cmd}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        {mode === "html" && (
          <>
            <Select onValueChange={(v) => exec("fontName", v)}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => exec("fontSize", v)}>
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="color"
              title="Text color"
              className="h-8 w-8 cursor-pointer rounded border p-0.5"
              onChange={(e) => exec("foreColor", e.target.value)}
            />
            <input
              type="color"
              title="Highlight color"
              className="h-8 w-8 cursor-pointer rounded border p-0.5"
              onChange={(e) => exec("hiliteColor", e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Insert link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={addLink}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Remove link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("unlink")}
            >
              <Link2Off className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Insert image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleImagePick}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Insert table"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertTable}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Checklist"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertChecklist}
            >
              <ListChecks className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Quote"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("formatBlock", "blockquote")}
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Code block"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("formatBlock", "pre")}
            >
              <Code className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Horizontal line"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertHorizontalRule")}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Clear formatting"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("removeFormat")}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Insert emoji"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded p-1 text-lg hover:bg-muted"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Mention"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <AtSign className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                {MENTION_SUGGESTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => insertMention(name)}
                  >
                    @{name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen editor"}
              onClick={() => setFullscreen((f) => !f)}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
        {onModeChange && (
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant={mode === "html" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onModeChange("html")}
            >
              HTML
            </Button>
            <Button
              type="button"
              variant={mode === "plain" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onModeChange("plain")}
            >
              Plain text
            </Button>
          </div>
        )}
      </div>
      {editorBody}
    </div>
  );

  if (fullscreen && mode === "html") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Fullscreen editor</p>
          <Button size="sm" variant="outline" onClick={() => setFullscreen(false)}>
            <Minimize2 className="mr-1 h-4 w-4" />
            Exit
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{shell}</div>
      </div>
    );
  }

  return shell;
}
