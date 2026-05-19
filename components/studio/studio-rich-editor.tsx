"use client";

import { forwardRef, useEffect, useRef, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { marked } from "marked";
import { Mark, mergeAttributes, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Flame, Scissors, RotateCcw } from "lucide-react";

export const ShimmerMark = Mark.create({
  name: "shimmer",
  addAttributes() {
    return {
      action: {
        default: "rephrase",
        parseHTML: (element) => element.getAttribute("data-action"),
        renderHTML: (attributes) => ({
          "data-action": attributes.action,
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-shimmer]" }];
  },
  renderHTML({ HTMLAttributes }) {
    let colorClass = "bg-primary/20 text-foreground/50";
    const action = HTMLAttributes["data-action"];
    if (action === "expand") colorClass = "bg-red-500/20 text-red-600/70 dark:text-red-400/70";
    if (action === "trim") colorClass = "bg-[#3CA6A6]/15 text-[#3CA6A6]/80";
    if (action === "rephrase") colorClass = "bg-amber-500/20 text-amber-600/70 dark:text-amber-400/70";

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-shimmer": "true",
        class: `animate-pulse rounded px-1 ${colorClass}`,
      }),
      0,
    ];
  },
});

const WordLimitExtension = Extension.create<{ maxLength?: number }>({
  name: "wordLimit",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wordLimit"),
        filterTransaction: (tr, state) => {
          if (!this.options.maxLength) return true;
          // Only check if document actually changed and user inserted content
          if (tr.docChanged && tr.steps.some(s => (s as any).slice?.content?.size > 0)) {
            const text = tr.doc.textContent;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            if (words > this.options.maxLength) {
              return false; // block the transaction
            }
          }
          return true;
        }
      })
    ];
  }
});

// ── Public handle exposed via ref ──────────────────────────────────────────────

export interface StudioRichEditorHandle {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getMarkdown: () => string;
}

interface StudioRichEditorProps {
  content: string;        // raw markdown string
  onUpdate?: (markdown: string) => void;
  readOnly?: boolean;
  /** Called just before an AI inline edit is applied — parent uses this to snapshot */
  onBeforeAiEdit?: () => void;
  maxLength?: number;
}

function mdToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

// Rudimentary HTML → markdown conversion (preserves headings, bold, paragraphs)
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "_$1_")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "_$1_")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1\n")
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, "$1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const StudioRichEditor = forwardRef<StudioRichEditorHandle, StudioRichEditorProps>(
  function StudioRichEditor({ content, onUpdate, readOnly = false, onBeforeAiEdit, maxLength }, ref) {
    const isUpdatingRef = useRef(false);
    const prevContentRef = useRef(content);

    const editor = useEditor({
      // Required in Next.js / SSR environments to prevent hydration mismatches.
      // Tiptap will defer rendering until the client is fully hydrated.
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Highlight.configure({ multicolor: true }),
        ShimmerMark,
        WordLimitExtension.configure({ maxLength }),
      ],
      content: mdToHtml(content),
      editable: !readOnly,
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none prose-headings:font-semibold prose-a:text-primary",
        },
      },
      onUpdate: ({ editor }) => {
        isUpdatingRef.current = true;
        const md = htmlToMarkdown(editor.getHTML());
        onUpdate?.(md);
        setTimeout(() => { isUpdatingRef.current = false; }, 0);
      },
    });

    // Expose imperative handle to parent
    useImperativeHandle(ref, () => ({
      undo: () => editor?.commands.undo(),
      redo: () => editor?.commands.redo(),
      canUndo: () => (editor ? editor.can().undo() : false),
      canRedo: () => (editor ? editor.can().redo() : false),
      getMarkdown: () => (editor ? htmlToMarkdown(editor.getHTML()) : ""),
    }), [editor]);

    // Sync when content prop changes externally (streaming)
    useEffect(() => {
      if (!editor || isUpdatingRef.current) return;
      if (content === prevContentRef.current) return;
      prevContentRef.current = content;
      editor.commands.setContent(mdToHtml(content), { emitUpdate: false });
    }, [content, editor]);

    // Sync maxLength when it changes
    useEffect(() => {
      if (!editor) return;
      editor.extensionManager.extensions.find(e => e.name === "wordLimit")!.options.maxLength = maxLength;
    }, [editor, maxLength]);

    if (!editor) return null;

    const handleInlineRefine = async (action: "expand" | "trim" | "rephrase") => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ");
      if (!text.trim()) return;

      // Notify parent to snapshot before AI edit
      onBeforeAiEdit?.();

      // Apply the shimmer animation mark immediately with color coding
      editor.chain().focus().setMark("shimmer", { action }).run();

      try {
        const { refineSelection } = await import("@/lib/generate/refine-selection");
        const refined = await refineSelection(text, action);

        // Find where the shimmer mark is now (user might have typed elsewhere)
        let shimmerFrom = -1;
        let shimmerTo = -1;
        editor.state.doc.descendants((node, pos) => {
          if (node.marks.find((m) => m.type.name === "shimmer")) {
            if (shimmerFrom === -1) shimmerFrom = pos;
            shimmerTo = pos + node.nodeSize;
          }
        });

        if (shimmerFrom !== -1 && shimmerTo !== -1) {
          editor
            .chain()
            .setTextSelection({ from: shimmerFrom, to: shimmerTo })
            .unsetMark("shimmer")
            .insertContent(refined)
            .run();
        } else {
          // Fallback if we couldn't find the shimmer mark
          editor.chain().setTextSelection({ from, to }).unsetMark("shimmer").insertContent(refined).run();
        }
      } catch (err) {
        console.error(`[Refine] Failed to ${action}:`, err);
        // Remove shimmer if error
        let shimmerFrom = -1;
        let shimmerTo = -1;
        editor.state.doc.descendants((node, pos) => {
          if (node.marks.find((m) => m.type.name === "shimmer")) {
            if (shimmerFrom === -1) shimmerFrom = pos;
            shimmerTo = pos + node.nodeSize;
          }
        });
        if (shimmerFrom !== -1) {
          editor.chain().setTextSelection({ from: shimmerFrom, to: shimmerTo }).unsetMark("shimmer").run();
        }
      }
    };

    return (
      <div className="relative">
        <BubbleMenu
          editor={editor}
          className="flex overflow-hidden rounded-lg border border-border bg-popover shadow-md divide-x divide-border"
        >
          <button
            onClick={() => handleInlineRefine("expand")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Flame className="size-3" />
            Expand
          </button>
          <button
            onClick={() => handleInlineRefine("trim")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#3CA6A6] hover:bg-[#3CA6A6]/10 transition-colors"
          >
            <Scissors className="size-3" />
            Trim
          </button>
          <button
            onClick={() => handleInlineRefine("rephrase")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <RotateCcw className="size-3" />
            Rephrase
          </button>
        </BubbleMenu>

        <EditorContent editor={editor} />
      </div>
    );
  }
);
