"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, ExternalLink, FileText, Linkedin, MoreHorizontal, PenLine, Share2, Sparkles, Trash2 } from "lucide-react";
import { writeClipboardText } from "@/lib/clipboard";
import { downloadPngDataUrl } from "@/lib/export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownEntryEditor } from "@/components/markdown-entry-editor";
import { SharedMarkdown } from "@/components/shared-markdown";
import { creationTitleFromMarkdown, ensureCreationDocument } from "@/lib/creation-document.mjs";

interface Creation {
  id: string;
  name?: string;
  platform?: string;
  format?: string;
  hashtags?: string[];
  outputMarkdown?: string;
  updatedAt?: number;
  creationKind?: string;
}

interface CreationsPageProps {
  creations: Creation[];
  onDeleteCreation: (id: string) => void;
  onUpdateCreation: (id: string, outputMarkdown: string, name: string) => void;
}

type SharePlatform = "linkedin" | "x" | "medium" | "substack";
type CoverFormat = "landscape" | "square" | "portrait";
type CoverStyle = "teal" | "ink" | "paper";

const SHARE_PLATFORMS: Record<SharePlatform, { label: string; url: string }> = {
  linkedin: { label: "LinkedIn", url: "https://www.linkedin.com/feed/" },
  x: { label: "X", url: "https://x.com/compose/post" },
  medium: { label: "Medium", url: "https://medium.com/new-story" },
  substack: { label: "Substack", url: "https://substack.com/home" },
};

function creationTypeLabel(creation: Pick<Creation, "platform" | "format" | "outputMarkdown">) {
  if (!creation.outputMarkdown?.trim()) return "Draft";
  if (creation.platform === "linkedin") return "LinkedIn post";
  if (creation.platform === "x") return creation.format === "thread" ? "X thread" : "X post";
  if (creation.platform === "substack") return "Substack newsletter";
  if (creation.platform === "medium") return "Medium article";
  return "Creation";
}

const COVER_FORMATS: Record<CoverFormat, { label: string; ratio: string; className: string }> = {
  landscape: { label: "Landscape · 16:9", ratio: "16 / 9", className: "w-full max-w-xl" },
  square: { label: "Square · 1:1", ratio: "1 / 1", className: "h-full max-h-[410px] max-w-full" },
  portrait: { label: "Portrait · 4:5", ratio: "4 / 5", className: "h-full max-h-[430px] max-w-full" },
};

const COVER_LAYOUTS: Record<CoverFormat, { body: string; title: string; excerpt: string }> = {
  landscape: {
    body: "py-3 sm:py-4",
    title: "line-clamp-3 text-[clamp(20px,3.2vw,34px)]",
    excerpt: "mt-3 line-clamp-2 text-[clamp(10px,1.2vw,13px)] leading-[1.45]",
  },
  square: {
    body: "py-5",
    title: "line-clamp-4 text-[clamp(22px,4vw,36px)]",
    excerpt: "mt-4 line-clamp-4 text-[clamp(11px,1.45vw,14px)] leading-relaxed",
  },
  portrait: {
    body: "py-6",
    title: "line-clamp-4 text-[clamp(22px,4vw,38px)]",
    excerpt: "mt-4 line-clamp-5 text-[clamp(11px,1.45vw,14px)] leading-relaxed",
  },
};

const COVER_STYLES: Record<CoverStyle, { label: string; className: string; mutedClassName: string }> = {
  teal: {
    label: "Teal",
    className: "bg-[#3CA6A6] text-white",
    mutedClassName: "text-white/75",
  },
  ink: {
    label: "Ink",
    className: "bg-foreground text-background",
    mutedClassName: "text-background/70",
  },
  paper: {
    label: "Paper",
    className: "bg-secondary text-secondary-foreground",
    mutedClassName: "text-muted-foreground",
  },
};

import { normalizeDisplayMarkdown } from "@/lib/display-markdown.mjs";

function normalizeCreationMarkdown(markdown: string): string {
  return normalizeDisplayMarkdown(markdown);
}

function creationExcerpt(markdown: string) {
  const lines = normalizeCreationMarkdown(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/.test(line) && !/^[-*]\s+\[[ xX]\]/.test(line) && !line.includes("|") && !/^#\w/.test(line))
    .map((line) => line.replace(/^[-*>]\s+/, "").replace(/[*_`~()]/g, "").replaceAll("[", "").replaceAll("]", "").replace(/\s+/g, " "));
  const meaningful = lines.filter((line) => line.length >= 36);
  return (meaningful.length > 0 ? meaningful : lines).join(" ").trim().slice(0, 220);
}

function safeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fikr-creation";
}

function creationDisplayTitle(creation: Creation) {
  return creationTitleFromMarkdown(creation.outputMarkdown ?? "", creation.name);
}

function openExternal(url: string) {
  const ipc = typeof window !== "undefined" ? (window as any).fikrStudio : null;
  if (ipc?.openUrl) return ipc.openUrl(url);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function CreationsPage({ creations, onDeleteCreation, onUpdateCreation }: CreationsPageProps) {
  // Persisted drafts are creations too. Keeping them visible prevents an
  // interrupted or older draft from becoming unreachable even though its
  // record still exists in the workspace.
  const visible = useMemo(() => creations, [creations]);
  const [selectedId, setSelectedId] = useState<string | null>(visible[0]?.id ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePlatform, setSharePlatform] = useState<SharePlatform>("linkedin");
  const [coverFormat, setCoverFormat] = useState<CoverFormat>("landscape");
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("teal");
  const [shareCopied, setShareCopied] = useState(false);
  const [coverDownloaded, setCoverDownloaded] = useState(false);
  const [isRenderingCover, setIsRenderingCover] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const coverRef = useRef<HTMLDivElement | null>(null);
  const selected = visible.find((creation) => creation.id === selectedId) ?? visible[0];
  const pendingDelete = visible.find((creation) => creation.id === pendingDeleteId);
  const editingCreation = visible.find((creation) => creation.id === editingId);
  const editingInitialMarkdown = editingCreation
    ? ensureCreationDocument(editingCreation.outputMarkdown ?? "", editingCreation.name)
    : "";
  const selectedDocumentMarkdown = selected
    ? ensureCreationDocument(selected.outputMarkdown ?? "", selected.name)
    : "";
  const selectedHasContent = Boolean(selected?.outputMarkdown?.trim());
  const selectedTitle = selected ? creationDisplayTitle(selected) : "Untitled creation";
  const activeCoverFormat = COVER_FORMATS[coverFormat];
  const activeCoverStyle = COVER_STYLES[coverStyle];
  const activeCoverLayout = COVER_LAYOUTS[coverFormat];

  useEffect(() => {
    if (selectedId && visible.some((creation) => creation.id === selectedId)) return;
    setSelectedId(visible[0]?.id ?? null);
  }, [selectedId, visible]);

  const copy = async (creation: Creation) => {
    await writeClipboardText(ensureCreationDocument(creation.outputMarkdown ?? "", creation.name));
    setCopiedId(creation.id);
    window.setTimeout(() => setCopiedId(null), 1_500);
  };

  const openShare = (creation: Creation) => {
    const platform = creation.platform as SharePlatform;
    setSharePlatform(platform in SHARE_PLATFORMS ? platform : "linkedin");
    setShareCopied(false);
    setCoverDownloaded(false);
    setShareError(null);
    setShareOpen(true);
  };

  const openEditor = (creation: Creation) => {
    setDraftMarkdown(ensureCreationDocument(creation.outputMarkdown ?? "", creation.name));
    setEditingId(creation.id);
  };

  const closeEditor = () => {
    setDraftMarkdown(editingInitialMarkdown);
    setEditingId(null);
  };

  const saveEditor = () => {
    if (!editingCreation || !draftMarkdown.trim()) return;
    const documentMarkdown = ensureCreationDocument(draftMarkdown, editingCreation.name);
    const title = creationTitleFromMarkdown(documentMarkdown, editingCreation.name);
    if (documentMarkdown === editingInitialMarkdown && title === editingCreation.name) {
      setEditingId(null);
      return;
    }
    onUpdateCreation(editingCreation.id, documentMarkdown, title);
    setEditingId(null);
  };

  const copyShareText = async () => {
    if (!selected) return;
    await writeClipboardText(ensureCreationDocument(selected.outputMarkdown ?? "", selected.name));
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1_500);
  };

  const downloadCover = async () => {
    if (!selected || !coverRef.current) return;
    setIsRenderingCover(true);
    setShareError(null);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(coverRef.current, { pixelRatio: 2, cacheBust: true });
      const saved = await downloadPngDataUrl(`${safeFileName(selectedTitle)}-cover.png`, dataUrl);
      if (!saved) return;
      setCoverDownloaded(true);
      window.setTimeout(() => setCoverDownloaded(false), 2_000);
    } catch {
      setShareError("Fikr couldn’t generate this cover. Try another style or format.");
    } finally {
      setIsRenderingCover(false);
    }
  };

  if (visible.length === 0) {
    return (
      <main className="flex min-h-0 flex-1 flex-col bg-background" data-testid="creations-empty">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 sm:px-5">
          <h1 className="fikr-toolbar-title">Creations</h1>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-sm">
              <PenLine className="size-6" />
            </span>
            <h2 className="fikr-page-title">Your creations will appear here</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask Fikr to write for LinkedIn, X, Substack, or Medium, then save the draft when it feels right.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 bg-background lg:grid-cols-[var(--fikr-context-sidebar-width)_minmax(0,1fr)]" data-testid="creations-page">
      <section className={`${mobileDetailOpen ? "hidden" : "flex"} min-h-0 flex-col overflow-hidden bg-sidebar/25 lg:flex lg:border-r lg:border-border`}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h1 className="fikr-toolbar-title">Creations</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary" aria-label={`${visible.length} ${visible.length === 1 ? "creation" : "creations"}`}>{visible.length}</span>
        </header>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {visible.map((creation) => (
            <div key={creation.id} className={`group relative flex items-center overflow-hidden rounded-lg transition-colors ${selected?.id === creation.id ? "bg-primary/10 ring-1 ring-inset ring-primary/15" : "hover:bg-secondary/55"}`}>
              {selected?.id === creation.id && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSelectedId(creation.id); setMobileDetailOpen(true); }}
                className="h-auto min-w-0 flex-1 justify-start rounded-lg px-3 py-3 text-left hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2.5">
                    <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal text-sm font-semibold leading-5 text-foreground/95">{creationDisplayTitle(creation)}</span>
                    <time className="shrink-0 pt-px text-xs font-medium tabular-nums text-muted-foreground">
                      {creation.updatedAt ? new Date(creation.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Just now"}
                    </time>
                  </span>
                  <span className="mt-1.5 flex min-w-0 items-center gap-1.5 leading-4">
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {creation.platform === "linkedin" ? <Linkedin className="size-3.5" /> : <FileText className="size-3.5" />}
                      {creationTypeLabel(creation)}
                    </span>
                  </span>
                </span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Creation options for ${creationDisplayTitle(creation)}`} className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingDeleteId(creation.id)}>
                    <Trash2 /> Delete creation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </section>

      <section className={`${mobileDetailOpen ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden lg:flex`}>
        {selected && (
          <>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-5" data-testid="creation-toolbar">
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMobileDetailOpen(false)} aria-label="Back to creations" className="-ml-1 shrink-0 lg:hidden">
                <ArrowLeft className="size-4" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-muted-foreground">
                {selected.platform === "linkedin" ? <Linkedin className="size-4" /> : <FileText className="size-4" />}
                <span>{creationTypeLabel(selected)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" aria-label="Edit creation" onClick={() => openEditor(selected)} className="h-8 gap-2 px-2.5">
                  <PenLine className="size-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button type="button" size="sm" aria-label="Share creation" onClick={() => openShare(selected)} disabled={!selectedHasContent} className="h-8 gap-2 px-2.5">
                  <Share2 className="size-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
                <Button type="button" size="sm" variant="secondary" aria-label={copiedId === selected.id ? "Creation copied" : "Copy creation"} onClick={() => void copy(selected)} disabled={!selectedHasContent} className="h-8 gap-2 px-2.5">
                  {copiedId === selected.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                  <span className="hidden sm:inline">{copiedId === selected.id ? "Copied" : "Copy"}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Creation options for ${selectedTitle}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingDeleteId(selected.id)}>
                      <Trash2 /> Delete creation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <article className="mx-auto w-full max-w-3xl px-5 pb-14 sm:px-8 lg:px-10">
                <header className="border-b border-border/70 pb-5 pt-9 sm:pb-6 sm:pt-11" data-testid="creation-document-header">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>{creationTypeLabel(selected)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Saved now"}</span>
                    {selected.hashtags && selected.hashtags.length > 0 && selected.platform === "medium" && (
                      <><span aria-hidden="true">·</span><span>{selected.hashtags.join(" · ")}</span></>
                    )}
                  </div>
                </header>
                <div className="py-7 sm:py-8">
                  <SharedMarkdown className="fikr-markdown--document">
                    {selectedDocumentMarkdown}
                  </SharedMarkdown>
                </div>
              </article>
            </div>
          </>
        )}
      </section>
      <MarkdownEntryEditor
        open={Boolean(editingCreation)}
        value={draftMarkdown}
        initialValue={editingInitialMarkdown}
        contextLabel={editingCreation ? creationDisplayTitle(editingCreation) : "Edit creation"}
        saveLabel="Save changes"
        onChange={setDraftMarkdown}
        onSave={saveEditor}
        onClose={closeEditor}
      />
      <Dialog open={shareOpen} onOpenChange={(open) => { setShareOpen(open); if (!open) setShareError(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-primary" /> Share creation
            </DialogTitle>
            <DialogDescription>Prepare the post and a polished cover image. Fikr never publishes without you.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="min-h-0 overflow-y-auto">
              <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex min-h-[300px] items-center justify-center bg-muted/30 p-5 sm:p-7 md:min-h-[480px]">
                  <div
                    ref={coverRef}
                    style={{ aspectRatio: activeCoverFormat.ratio }}
                    className={`${activeCoverFormat.className} ${activeCoverStyle.className} flex flex-col overflow-hidden rounded-xl p-6 shadow-sm sm:p-8`}
                    data-testid="creation-cover-preview"
                  >
                    <div className="flex justify-end">
                      <span className={`text-[10px] font-medium uppercase tracking-[0.1em] ${activeCoverStyle.mutedClassName}`}>
                        {SHARE_PLATFORMS[sharePlatform].label}
                      </span>
                    </div>

                    <div className={`flex min-h-0 flex-1 flex-col justify-center ${activeCoverLayout.body}`}>
                      <h3 className={`${activeCoverLayout.title} font-serif font-semibold leading-[1.05] tracking-[-0.035em]`}>
                        {selectedTitle || "Knowledge into action"}
                      </h3>
                      <p className={`${activeCoverLayout.excerpt} ${activeCoverStyle.mutedClassName}`}>
                        {creationExcerpt(selectedDocumentMarkdown)}
                      </p>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-border p-5 md:border-t-0 md:border-l md:p-6">
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="share-platform" className="mb-1.5 block text-xs font-medium text-foreground">Destination</label>
                      <Select value={sharePlatform} onValueChange={(value) => setSharePlatform(value as SharePlatform)}>
                        <SelectTrigger id="share-platform" aria-label="Share destination">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SHARE_PLATFORMS).map(([value, platform]) => (
                            <SelectItem key={value} value={value}>{platform.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label htmlFor="cover-format" className="mb-1.5 block text-xs font-medium text-foreground">Cover format</label>
                      <Select value={coverFormat} onValueChange={(value) => setCoverFormat(value as CoverFormat)}>
                        <SelectTrigger id="cover-format" aria-label="Cover format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COVER_FORMATS).map(([value, format]) => (
                            <SelectItem key={value} value={value}>{format.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-foreground">Cover style</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(Object.entries(COVER_STYLES) as [CoverStyle, typeof COVER_STYLES[CoverStyle]][]).map(([value, style]) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={coverStyle === value ? "secondary" : "outline"}
                            onClick={() => setCoverStyle(value)}
                            aria-pressed={coverStyle === value}
                            className="px-2 text-xs"
                          >
                            {style.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-secondary/35 p-3">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                        <p className="text-xs leading-5 text-muted-foreground">The cover is generated locally from this creation. Nothing is uploaded or posted automatically.</p>
                      </div>
                    </div>

                    {shareError && <p role="alert" className="text-xs leading-5 text-destructive">{shareError}</p>}
                  </div>
                </aside>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border px-5 py-4 sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyShareText()}>
              {shareCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {shareCopied ? "Post copied" : "Copy post"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" size="sm" onClick={() => void downloadCover()} disabled={isRenderingCover}>
                {coverDownloaded ? <Check className="size-4" /> : <Download className="size-4" />}
                {isRenderingCover ? "Generating…" : coverDownloaded ? "Cover downloaded" : "Download cover"}
              </Button>
              <Button type="button" size="sm" onClick={() => openExternal(SHARE_PLATFORMS[sharePlatform].url)}>
                <ExternalLink className="size-4" /> Open {SHARE_PLATFORMS[sharePlatform].label}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this creation?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name || "This creation"} will be removed. You can undo immediately afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) onDeleteCreation(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete creation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
