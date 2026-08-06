"use client";

import * as React from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { indentWithTab, redo, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { useTheme } from "next-themes";
import {
  Bold,
  Braces,
  Check,
  Code2,
  FileText,
  Heading1,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Search,
  Sparkles,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeMarkdownForRichEditor } from "@/lib/markdown-entry";
import {
  formatMarkdownWithAi,
  type MarkdownFormatMode,
} from "@/lib/generate/format-markdown";

export type MarkdownEditorViewMode = "write" | "source";

interface MarkdownEntryEditorProps {
  open: boolean;
  value: string;
  initialValue?: string;
  contextLabel?: string;
  saveLabel?: string;
  draftIsRecoverable?: boolean;
  initialCursor?: number;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  onDiscard?: () => void;
}

type ToolbarButtonProps = React.ComponentProps<typeof Button> & {
  label: string;
};

type MarkdownFormattingTarget = {
  scope: "selection" | "document";
  source: string;
  documentValue: string;
  origin: MarkdownEditorViewMode;
  from?: number;
  to?: number;
};

function ToolbarButton({ label, className, ...props }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn(
        "size-8 rounded-lg text-muted-foreground/70 hover:bg-secondary/70 hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MarkdownEntryEditor({
  open,
  value,
  initialValue = "",
  contextLabel = "New entry",
  saveLabel = "Save entry",
  draftIsRecoverable = false,
  initialCursor,
  onChange,
  onSave,
  onClose,
  onDiscard,
}: MarkdownEntryEditorProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = React.useRef<ReactCodeMirrorRef>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const lastRichMarkdownRef = React.useRef(value);
  const formattingAbortRef = React.useRef<AbortController | null>(null);
  const [viewMode, setViewMode] = React.useState<MarkdownEditorViewMode>("write");
  const [formattingMode, setFormattingMode] = React.useState<MarkdownFormatMode | null>(null);
  const [formattingError, setFormattingError] = React.useState<string | null>(null);
  const [formattingNotice, setFormattingNotice] = React.useState<string | null>(null);
  const hasContent = value.trim().length > 0;
  const isDirty = value !== initialValue;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const statusLabel = isDirty
    ? draftIsRecoverable
      ? "Draft saved locally"
      : "Unsaved changes"
    : "Up to date";

  const richEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        placeholder: "Start with a thought…",
        emptyEditorClass: "is-editor-empty",
      }),
      Markdown.configure({ indentation: { style: "space", size: 2 } }),
    ],
    content: normalizeMarkdownForRichEditor(value),
    contentType: "markdown",
    editorProps: {
      attributes: {
        class:
          "prose prose-base dark:prose-invert min-h-full max-w-none focus:outline-none prose-headings:tracking-tight prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-a:text-primary prose-pre:shadow-sm",
        "aria-label": "Rich Markdown entry",
      },
    },
    onUpdate: ({ editor }) => {
      const markdownValue = editor.getMarkdown();
      lastRichMarkdownRef.current = markdownValue;
      onChange(markdownValue);
    },
  });

  React.useEffect(() => {
    if (!richEditor || value === lastRichMarkdownRef.current) return;
    lastRichMarkdownRef.current = value;
    richEditor.commands.setContent(normalizeMarkdownForRichEditor(value), {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [richEditor, value]);

  const extensions = React.useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      placeholder("Start writing…  Markdown is supported."),
      keymap.of([indentWithTab]),
      EditorView.theme({
        "&": {
          height: "100%",
          backgroundColor: "transparent",
          color: "var(--foreground)",
          fontSize: "17px",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-sans)",
          lineHeight: "1.8",
          padding: "112px clamp(24px, 7vw, 96px) 180px",
          scrollbarWidth: "thin",
        },
        ".cm-content": {
          maxWidth: "780px",
          margin: "0 auto",
          caretColor: "#3CA6A6",
          padding: "0",
        },
        ".cm-gutters": {
          display: "none",
        },
        ".cm-line": { padding: "0" },
        ".cm-activeLine": { backgroundColor: "transparent" },
        ".cm-placeholder": {
          color: "color-mix(in oklch, var(--muted-foreground) 48%, transparent)",
          fontFamily: "var(--font-sans)",
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          backgroundColor: "color-mix(in oklch, #3CA6A6 28%, transparent) !important",
        },
        ".cm-cursor": { borderLeftColor: "#3CA6A6" },
        ".cm-focused": { outline: "none" },
        ".cm-panels": {
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
        },
        ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
        ".cm-textfield": {
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        },
      }),
    ],
    [],
  );

  React.useEffect(() => {
    if (!open) return;
    setViewMode("write");
    setFormattingError(null);
    setFormattingNotice(null);
    const timer = window.setTimeout(() => {
      if (richEditor) {
        richEditor.commands.focus("end");
        return;
      }
      const view = editorRef.current?.view;
      if (!view) return;
      const cursor = Math.max(0, Math.min(initialCursor ?? view.state.doc.length, view.state.doc.length));
      view.dispatch({ selection: { anchor: cursor } });
      view.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [initialCursor, open, richEditor]);

  React.useEffect(() => () => formattingAbortRef.current?.abort(), []);

  React.useEffect(() => {
    if (!formattingNotice) return;
    const timer = window.setTimeout(() => setFormattingNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [formattingNotice]);

  React.useEffect(() => {
    if (!open) return;
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const primary = event.metaKey || event.ctrlKey;
      const isSaveShortcut =
        (event.key === "Enter" && primary) ||
        (event.key.toLowerCase() === "s" && primary && !event.shiftKey && !event.altKey);
      if (isSaveShortcut && hasContent) {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut, true);
    return () => window.removeEventListener("keydown", handleSaveShortcut, true);
  }, [hasContent, onSave, open]);

  const requestClose = React.useCallback(() => {
    if (
      isDirty &&
      !draftIsRecoverable &&
      !window.confirm("Discard your unsaved Markdown changes?")
    ) {
      return;
    }
    formattingAbortRef.current?.abort();
    formattingAbortRef.current = null;
    setFormattingMode(null);
    onClose();
  }, [draftIsRecoverable, isDirty, onClose]);

  const replaceSelection = React.useCallback(
    (opening: string, closing: string, placeholder: string) => {
      const view = editorRef.current?.view;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const content = selected || placeholder;
      const inserted = `${opening}${content}${closing}`;
      view.dispatch({
        changes: { from, to, insert: inserted },
        selection: selected
          ? { anchor: from + opening.length, head: from + opening.length + selected.length }
          : { anchor: from + opening.length, head: from + opening.length + placeholder.length },
      });
      view.focus();
    },
    [],
  );

  const toggleLinePrefix = React.useCallback((prefix: string) => {
    const view = editorRef.current?.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const startLine = view.state.doc.lineAt(from);
    const endLine = view.state.doc.lineAt(to);
    const lineBlock = view.state.sliceDoc(startLine.from, endLine.to);
    const lines = lineBlock.split("\n");
    const allPrefixed = lines.every((line) => line.startsWith(prefix));
    const replacement = lines
      .map((line) => (allPrefixed ? line.slice(prefix.length) : `${prefix}${line}`))
      .join("\n");
    view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert: replacement },
      selection: { anchor: startLine.from, head: startLine.from + replacement.length },
    });
    view.focus();
  }, []);

  const insertBlock = React.useCallback((markdownBlock: string) => {
    const view = editorRef.current?.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const inserted = markdownBlock.replace("{{selection}}", selected || "");
    view.dispatch({
      changes: { from, to, insert: inserted },
      selection: { anchor: from + inserted.length },
    });
    view.focus();
  }, []);

  const toggleHeading = React.useCallback((level: 1 | 2) => {
    if (viewMode === "write" && richEditor) {
      richEditor.chain().focus().toggleHeading({ level }).run();
      return;
    }
    toggleLinePrefix(`${"#".repeat(level)} `);
  }, [richEditor, toggleLinePrefix, viewMode]);

  const richSelectionContainsCode = React.useCallback(() => {
    if (!richEditor) return false;
    const { from, to } = richEditor.state.selection;
    if (from === to) return richEditor.isActive("code");
    let containsCode = false;
    richEditor.state.doc.nodesBetween(from, to, (node) => {
      if (node.marks.some((mark) => mark.type.name === "code")) containsCode = true;
      return !containsCode;
    });
    return containsCode;
  }, [richEditor]);

  const toggleBold = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      if (richSelectionContainsCode()) return;
      richEditor.chain().focus().toggleBold().run();
    }
    else replaceSelection("**", "**", "bold text");
  }, [replaceSelection, richEditor, richSelectionContainsCode, viewMode]);

  const toggleItalic = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      if (richSelectionContainsCode()) return;
      richEditor.chain().focus().toggleItalic().run();
    }
    else replaceSelection("_", "_", "italic text");
  }, [replaceSelection, richEditor, richSelectionContainsCode, viewMode]);

  const toggleStrike = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      if (richSelectionContainsCode()) return;
      richEditor.chain().focus().toggleStrike().run();
    }
    else replaceSelection("~~", "~~", "struck text");
  }, [replaceSelection, richEditor, richSelectionContainsCode, viewMode]);

  const toggleInlineCode = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      richEditor
        .chain()
        .focus()
        .unsetBold()
        .unsetItalic()
        .unsetStrike()
        .unsetLink()
        .toggleCode()
        .run();
    }
    else replaceSelection("`", "`", "code");
  }, [replaceSelection, richEditor, viewMode]);

  const setLink = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      if (richSelectionContainsCode()) return;
      const previousUrl = richEditor.getAttributes("link").href as string | undefined;
      const url = window.prompt("Link URL", previousUrl || "https://");
      if (url === null) return;
      if (!url.trim()) richEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      else richEditor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
      return;
    }
    replaceSelection("[", "](https://)", "link text");
  }, [replaceSelection, richEditor, richSelectionContainsCode, viewMode]);

  const toggleBulletList = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().toggleBulletList().run();
    else toggleLinePrefix("- ");
  }, [richEditor, toggleLinePrefix, viewMode]);

  const toggleOrderedList = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().toggleOrderedList().run();
    else toggleLinePrefix("1. ");
  }, [richEditor, toggleLinePrefix, viewMode]);

  const toggleTaskList = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().toggleTaskList().run();
    else toggleLinePrefix("- [ ] ");
  }, [richEditor, toggleLinePrefix, viewMode]);

  const toggleBlockquote = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().toggleBlockquote().run();
    else toggleLinePrefix("> ");
  }, [richEditor, toggleLinePrefix, viewMode]);

  const toggleCodeBlock = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().toggleCodeBlock().run();
    else insertBlock("```\n{{selection}}\n```");
  }, [insertBlock, richEditor, viewMode]);

  const insertTable = React.useCallback(() => {
    if (viewMode === "write" && richEditor) {
      const command = richEditor.chain().focus();
      if (richEditor.isActive("taskList")) command.liftListItem("taskItem");
      else if (richEditor.isActive("bulletList") || richEditor.isActive("orderedList")) {
        command.liftListItem("listItem");
      }
      command.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
      return;
    }
    insertBlock("| Column | Column |\n| --- | --- |\n| Value | Value |\n");
  }, [insertBlock, richEditor, viewMode]);

  const insertHorizontalRule = React.useCallback(() => {
    if (viewMode === "write" && richEditor) richEditor.chain().focus().setHorizontalRule().run();
    else insertBlock("\n---\n");
  }, [insertBlock, richEditor, viewMode]);

  const getFormattingTarget = React.useCallback((): MarkdownFormattingTarget | null => {
    if (!hasContent) return null;
    let target: MarkdownFormattingTarget = {
      scope: "document",
      source: value,
      documentValue: value,
      origin: viewMode,
    };

    if (viewMode === "write" && richEditor && !richEditor.state.selection.empty) {
      const { from, to } = richEditor.state.selection;
      const content = richEditor.state.selection.content().content.toJSON();
      const source = richEditor.markdown?.serialize({ type: "doc", content })
        || richEditor.state.doc.textBetween(from, to, "\n\n");
      if (source.trim()) {
        target = { scope: "selection", source, documentValue: value, origin: "write", from, to };
      }
    } else if (viewMode === "source") {
      const view = editorRef.current?.view;
      if (view && !view.state.selection.main.empty) {
        const { from, to } = view.state.selection.main;
        target = {
          scope: "selection",
          source: view.state.sliceDoc(from, to),
          documentValue: value,
          origin: "source",
          from,
          to,
        };
      }
    }
    return target;
  }, [hasContent, richEditor, value, viewMode]);

  const runFormatter = React.useCallback(async (mode: MarkdownFormatMode) => {
    const target = getFormattingTarget();
    if (!target) return;
    formattingAbortRef.current?.abort();
    const controller = new AbortController();
    formattingAbortRef.current = controller;
    setFormattingMode(mode);
    setFormattingError(null);
    setFormattingNotice(null);
    try {
      const formatted = await formatMarkdownWithAi(
        target.source,
        mode,
        target.scope,
        controller.signal,
      );
      const richFormatted = normalizeMarkdownForRichEditor(formatted);
      if (valueRef.current !== target.documentValue) {
        throw new Error("The document changed while AI was working. Run the tool again.");
      }

      const { scope, origin, from, to } = target;
      if (scope === "document" && origin === "source") {
        const view = editorRef.current?.view;
        if (view) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted },
            selection: { anchor: formatted.length },
          });
          view.focus();
        }
      } else if (scope === "document" && origin === "write" && richEditor) {
        richEditor.commands.insertContentAt(
          { from: 0, to: richEditor.state.doc.content.size },
          richFormatted,
          { contentType: "markdown", updateSelection: true },
        );
      } else if (scope === "document") {
        lastRichMarkdownRef.current = formatted;
        richEditor?.commands.setContent(richFormatted, { contentType: "markdown", emitUpdate: false });
        onChange(formatted);
      } else if (origin === "write" && richEditor && from !== undefined && to !== undefined) {
        richEditor.commands.insertContentAt(
          { from, to },
          richFormatted,
          { contentType: "markdown", updateSelection: true },
        );
      } else if (origin === "source" && from !== undefined && to !== undefined) {
        const view = editorRef.current?.view;
        if (view) {
          view.dispatch({
            changes: { from, to, insert: formatted },
            selection: { anchor: from + formatted.length },
          });
          view.focus();
        }
      }
      setFormattingNotice(mode === "cleanup" ? "Markdown cleaned up. Undo to revert." : "Markdown formatted. Undo to revert.");
    } catch (error) {
      if (!controller.signal.aborted) {
        setFormattingError(error instanceof Error ? error.message : "AI formatting failed.");
      }
    } finally {
      if (formattingAbortRef.current === controller) formattingAbortRef.current = null;
      setFormattingMode(null);
    }
  }, [getFormattingTarget, onChange, richEditor]);

  React.useEffect(() => {
    if (!open) return;
    const handleFormattingShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        toggleBold();
      } else if (key === "i") {
        event.preventDefault();
        toggleItalic();
      } else if (key === "k") {
        event.preventDefault();
        setLink();
      }
    };
    window.addEventListener("keydown", handleFormattingShortcut, true);
    return () => window.removeEventListener("keydown", handleFormattingShortcut, true);
  }, [open, setLink, toggleBold, toggleItalic]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Markdown editor</DialogTitle>
        <DialogDescription className="sr-only">
          Write a formatted Markdown entry before saving it to the workspace.
        </DialogDescription>

        <header className="flex h-16 min-w-0 items-center justify-between gap-4 border-b border-border/35 bg-background/95 pr-4 pl-4 backdrop-blur-xl sm:pr-5 sm:pl-20">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">{contextLabel}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/65">
                <span className={cn("size-1.5 rounded-full", isDirty ? "bg-amber-400" : "bg-emerald-400")} />
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-xl bg-secondary/45 p-1 ring-1 ring-inset ring-border/35">
              {([
                ["write", FileText, "Write"],
                ["source", Braces, "Source"],
              ] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-label={label}
                  aria-pressed={viewMode === mode}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                    viewMode === mode
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/35"
                      : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
            <Button type="button" size="sm" onClick={onSave} disabled={!hasContent} title="Save (⌘S)" className="rounded-xl px-4 shadow-sm">
              <Check className="size-3.5" />
              <span className="hidden sm:inline">{saveLabel}</span><span className="sm:hidden">Save</span>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={requestClose} aria-label="Close editor" className="rounded-xl text-muted-foreground">
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <main className="relative min-h-0 overflow-hidden bg-background">
          <div className="pointer-events-none absolute top-5 right-4 left-4 z-30 flex justify-center">
              <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-border/45 bg-card/90 p-1.5 shadow-lg shadow-black/5 backdrop-blur-xl custom-scrollbar">
                <ToolbarButton label="Undo" onClick={() => viewMode === "write" ? richEditor?.chain().focus().undo().run() : editorRef.current?.view && undo(editorRef.current.view)}><Undo2 /></ToolbarButton>
                <ToolbarButton label="Redo" onClick={() => viewMode === "write" ? richEditor?.chain().focus().redo().run() : editorRef.current?.view && redo(editorRef.current.view)}><Redo2 /></ToolbarButton>
                {viewMode === "source" && <ToolbarButton label="Find and replace" onClick={() => editorRef.current?.view && openSearchPanel(editorRef.current.view)}><Search /></ToolbarButton>}
                <span className="mx-1 h-5 w-px shrink-0 bg-border/55" />
                <ToolbarButton
                  label="Format Markdown"
                  onClick={() => runFormatter("structure")}
                  disabled={!hasContent || formattingMode !== null}
                >
                  {formattingMode === "structure" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                </ToolbarButton>
                <ToolbarButton
                  label="Clean up Markdown"
                  onClick={() => runFormatter("cleanup")}
                  disabled={!hasContent || formattingMode !== null}
                >
                  {formattingMode === "cleanup" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                </ToolbarButton>
                <span className="mx-1 h-5 w-px shrink-0 bg-border/55" />
                <ToolbarButton label="Heading 1" onClick={() => toggleHeading(1)} className={cn(viewMode === "write" && richEditor?.isActive("heading", { level: 1 }) && "bg-secondary text-foreground")}><Heading1 /></ToolbarButton>
                <ToolbarButton label="Heading 2" onClick={() => toggleHeading(2)} className={cn(viewMode === "write" && richEditor?.isActive("heading", { level: 2 }) && "bg-secondary text-foreground")}><span className="text-[11px] font-bold">H2</span></ToolbarButton>
                <ToolbarButton label="Bold" onClick={toggleBold} className={cn(viewMode === "write" && richEditor?.isActive("bold") && "bg-secondary text-foreground")}><Bold /></ToolbarButton>
                <ToolbarButton label="Italic" onClick={toggleItalic} className={cn(viewMode === "write" && richEditor?.isActive("italic") && "bg-secondary text-foreground")}><Italic /></ToolbarButton>
                <ToolbarButton label="Strikethrough" onClick={toggleStrike} className={cn(viewMode === "write" && richEditor?.isActive("strike") && "bg-secondary text-foreground")}><Strikethrough /></ToolbarButton>
                <ToolbarButton label="Link" onClick={setLink} className={cn(viewMode === "write" && richEditor?.isActive("link") && "bg-secondary text-foreground")}><Link /></ToolbarButton>
                <ToolbarButton label="Inline code" onClick={toggleInlineCode} className={cn(viewMode === "write" && richEditor?.isActive("code") && "bg-secondary text-foreground")}><Code2 /></ToolbarButton>
                <span className="mx-1 h-5 w-px shrink-0 bg-border/55" />
                <ToolbarButton label="Bulleted list" onClick={toggleBulletList} className={cn(viewMode === "write" && richEditor?.isActive("bulletList") && "bg-secondary text-foreground")}><List /></ToolbarButton>
                <ToolbarButton label="Numbered list" onClick={toggleOrderedList} className={cn(viewMode === "write" && richEditor?.isActive("orderedList") && "bg-secondary text-foreground")}><ListOrdered /></ToolbarButton>
                <ToolbarButton label="Task list" onClick={toggleTaskList} className={cn(viewMode === "write" && richEditor?.isActive("taskList") && "bg-secondary text-foreground")}><ListChecks /></ToolbarButton>
                <ToolbarButton label="Blockquote" onClick={toggleBlockquote} className={cn(viewMode === "write" && richEditor?.isActive("blockquote") && "bg-secondary text-foreground")}><Quote /></ToolbarButton>
                <ToolbarButton label="Code block" onClick={toggleCodeBlock} className={cn(viewMode === "write" && richEditor?.isActive("codeBlock") && "bg-secondary text-foreground")}><Braces /></ToolbarButton>
                <ToolbarButton label="Table" onClick={insertTable}><Table2 /></ToolbarButton>
                <ToolbarButton label="Horizontal rule" onClick={insertHorizontalRule}><Minus /></ToolbarButton>
              </div>
            </div>

          {(formattingError || formattingNotice) && (
            <div
              role={formattingError ? "alert" : "status"}
              className={cn(
                "absolute top-[4.75rem] left-1/2 z-30 flex max-w-[min(90vw,560px)] -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl",
                formattingError
                  ? "border-destructive/25 bg-background/95 text-destructive"
                  : "border-primary/20 bg-background/95 text-foreground/75",
              )}
            >
              {formattingError ? formattingError : formattingNotice}
              <button
                type="button"
                onClick={() => { setFormattingError(null); setFormattingNotice(null); }}
                className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss AI formatting message"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {viewMode === "write" && (
            <section className="h-full overflow-y-auto custom-scrollbar" aria-label="Rich Markdown editor">
              <div className="markdown-rich-editor mx-auto min-h-full max-w-[820px] px-6 pt-28 pb-44 sm:px-10 md:px-14">
                {richEditor && (
                  <BubbleMenu editor={richEditor} className="flex items-center gap-0.5 rounded-xl border border-border/50 bg-popover/95 p-1 shadow-xl backdrop-blur-xl">
                    <ToolbarButton label="Bold" onClick={toggleBold} className={cn(richEditor.isActive("bold") && "bg-secondary text-foreground")}><Bold /></ToolbarButton>
                    <ToolbarButton label="Italic" onClick={toggleItalic} className={cn(richEditor.isActive("italic") && "bg-secondary text-foreground")}><Italic /></ToolbarButton>
                    <ToolbarButton label="Link" onClick={setLink} className={cn(richEditor.isActive("link") && "bg-secondary text-foreground")}><Link /></ToolbarButton>
                    <ToolbarButton label="Inline code" onClick={toggleInlineCode} className={cn(richEditor.isActive("code") && "bg-secondary text-foreground")}><Code2 /></ToolbarButton>
                  </BubbleMenu>
                )}
                <EditorContent editor={richEditor} />
              </div>
            </section>
          )}

          {viewMode === "source" && (
            <section className="h-full overflow-hidden" aria-label="Markdown source">
              <CodeMirror
                ref={editorRef}
                value={value}
                onChange={onChange}
                extensions={extensions}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  searchKeymap: true,
                }}
                height="100%"
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                className="h-full [&_.cm-editor]:h-full"
                aria-label="Markdown entry"
              />
            </section>
          )}

        </main>

        <footer className="flex h-11 min-w-0 items-center justify-between gap-3 border-t border-border/25 bg-background/90 px-4 text-[11px] text-muted-foreground/60 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span>{wordCount.toLocaleString()} words</span><span className="opacity-35">·</span><span>{value.length.toLocaleString()} characters</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline">⌘ S to save</span>
            {onDiscard && (
              <Button type="button" variant="ghost" size="xs" onClick={onDiscard} disabled={!hasContent} className="rounded-lg text-muted-foreground/60 hover:text-destructive">
                <Trash2 className="size-3" />
                Discard
              </Button>
            )}
          </div>
        </footer>

        <style>{`
          .markdown-rich-editor .ProseMirror { min-height: calc(100dvh - 18rem); }
          .markdown-rich-editor .is-editor-empty:first-child::before {
            color: color-mix(in oklch, var(--muted-foreground) 48%, transparent);
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .markdown-rich-editor .ProseMirror h1 { font-family: var(--font-display); font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 500; line-height: 1.14; margin: 0 0 1.25rem; letter-spacing: -0.02em; }
          .markdown-rich-editor .ProseMirror h2 { font-family: var(--font-display); font-size: 1.65rem; font-weight: 500; line-height: 1.25; margin-top: 2.4rem; letter-spacing: -0.02em; }
          .markdown-rich-editor .ProseMirror h3 { font-family: var(--font-sans); font-size: 1.25rem; font-weight: 600; margin-top: 2rem; }
          .markdown-rich-editor .ProseMirror p { font-size: 1.05rem; line-height: 1.82; margin-bottom: 0.9rem; }
          .markdown-rich-editor .ProseMirror blockquote { border-left: 2px solid #3CA6A6; font-family: var(--font-sans); font-size: 1rem; padding: 0.25rem 0 0.25rem 1.25rem; }
          .markdown-rich-editor .ProseMirror pre { border-radius: 12px; padding: 1rem 1.15rem; }
          .markdown-rich-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
          .markdown-rich-editor .ProseMirror li[data-type="taskItem"] { align-items: flex-start; display: flex; gap: 0.65rem; }
          .markdown-rich-editor .ProseMirror li[data-type="taskItem"] > label { margin-top: 0.32rem; }
          .markdown-rich-editor .ProseMirror li[data-type="taskItem"] > div { flex: 1; }
          .markdown-rich-editor .ProseMirror table { border-collapse: collapse; margin: 1.5rem 0; width: 100%; }
          .markdown-rich-editor .ProseMirror th,
          .markdown-rich-editor .ProseMirror td { border: 1px solid color-mix(in oklch, var(--border) 65%, transparent); padding: 0.65rem 0.8rem; text-align: left; }
          .markdown-rich-editor .ProseMirror th { background: color-mix(in oklch, var(--secondary) 55%, transparent); font-weight: 600; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
